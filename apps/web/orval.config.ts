import { defineConfig } from "orval";

export default defineConfig({
    api: {
        input: "http://localhost:8000/openapi.json",
        output: {
            mode: "tags-split",
            target: "src/api/generated",
            schemas: "src/api/generated/model",
            client: "react-query",
            httpClient: "fetch",
        },
    },
});