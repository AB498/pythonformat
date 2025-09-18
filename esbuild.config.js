const { build } = require("esbuild");
const { copy } = require("esbuild-plugin-copy");

(async () => {
    try {
        await build({
            entryPoints: ["./src/*.js"], // Add your JavaScript source files
            outdir: "./out",            // Output directory
            minify: true,               // Minify the output
            bundle: true,               // Bundle files
            platform: "node",           // Target platform (Node.js)
            external: ["vscode"],       // Exclude `vscode` module
            plugins: [
                copy({
                    assets: [
                        {
                            from: "./lib/*.wasm", // Source files (your .wasm files)
                            to: "./",          // Destination directory
                        },
                    ],
                }),
            ],
        });

        console.log("Build completed successfully!");
    } catch (error) {
        console.error("Build failed:", error);
        process.exit(1);
    }
})();
