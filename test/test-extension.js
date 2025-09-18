let { Workspace } = require('@astral-sh/ruff-wasm-nodejs');

const exampleDocument = `


x= s


print('hello'); print("world")

`;

// These are default settings just to illustrate configuring Ruff
// Settings info: https://docs.astral.sh/ruff/settings
const workspace = new Workspace({
    'line-length': 88,
    'indent-width': 4,
    format: {
        'indent-style': 'space',
        'quote-style': 'double',
    },
    lint: {
        select: [
            'E4',
            'E7',
            'E9',
            'F'
        ],
    },
});

// const formatted = workspace.format(exampleDocument);
const diagnostics = workspace.check(exampleDocument);

for (let i in diagnostics) {
    d = diagnostics[i];
    console.log(i, d?.location)
}

