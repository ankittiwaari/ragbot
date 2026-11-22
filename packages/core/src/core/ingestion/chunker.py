import asyncio
import hashlib
from dataclasses import dataclass, field

from core.config import settings
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    TableFormerMode,
    TableStructureOptions,
    ThreadedPdfPipelineOptions,
)
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer


@dataclass
class Chunk:
    doc_id: str
    chunk_index: int
    text: str  # raw chunk text: shown to the user and the LLM
    embed_text: str  # heading path + text: what you embed and BM25-index
    source: str
    heading_path: list[str] = field(default_factory=list)
    pages: list[int] = field(default_factory=list)
    item_types: list[str] = field(default_factory=list)  # e.g. ["table", "text"]
    doc_version: str = ""
    chunk_hash: str = ""
    embedding: list[float] | None = None


def build_converter(ocr: bool = False) -> DocumentConverter:
    options = ThreadedPdfPipelineOptions(
        do_ocr=ocr,
        do_table_structure=True,
        table_structure_options=TableStructureOptions(
            mode=TableFormerMode.ACCURATE, do_cell_matching=True
        ),
    )
    return DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)}
    )


def build_chunker() -> HybridChunker:
    tokenizer = HuggingFaceTokenizer.from_pretrained(
        settings.embed_tokenizer, max_tokens=settings.max_token
    )
    return HybridChunker(
        tokenizer=tokenizer, merge_peers=True, repeat_table_header=True
    )


def chunk_file(
    file_path: str, doc_id: str, converter: DocumentConverter, chunker: HybridChunker
) -> list[Chunk]:
    doc = converter.convert(file_path).document
    doc_version = hashlib.sha256(doc.export_to_markdown().encode()).hexdigest()[:16]
    out: list[Chunk] = []
    for i, ch in enumerate(chunker.chunk(dl_doc=doc)):
        embed_text = chunker.contextualize(chunk=ch)
        items = ch.meta.doc_items
        out.append(
            Chunk(
                doc_id=doc_id,
                chunk_index=i,
                text=ch.text,
                embed_text=embed_text,
                source=file_path,
                heading_path=list(ch.meta.headings or []),
                pages=sorted({p.page_no for item in items for p in item.prov}),
                item_types=sorted({item.label.value for item in items}),
                doc_version=doc_version,
                chunk_hash=hashlib.sha256(embed_text.encode()).hexdigest()[:16],
            )
        )
    return out


async def embed_file(file_path: str):
    print(f"Chunking {file_path}")
    converter, chunker = (build_converter(), build_chunker())
    chunks = await asyncio.to_thread(
        chunk_file,
        file_path=file_path,
        doc_id="uploaded",
        converter=converter,
        chunker=chunker,
    )
    print(chunks)
    print("Chunked")
