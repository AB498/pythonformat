const vscode = require('vscode');
let fs = require("fs");
let path = require("path");
let axios = require("axios");
let { Workspace } = require('@astral-sh/ruff-wasm-nodejs');

let extensionPath = path.join(__dirname, "..");

const wsp = new Workspace({
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
const format = (text) => {
	let [res, err] = [null, null];
	try {
		res = wsp.format(text)
	} catch (error) {
		err = error;
		console.error(error);
	}
	return [res, err];
};

const check = (text) => {
	let [res, err] = [null, null];
	try {
		res = wsp.check(text)
	} catch (error) {
		err = error;
		console.error(error);
	}
	return [res, err];
};

allDecors = [];
documentStates = {};

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	context.subscriptions.push(
		vscode.commands.registerCommand('pythonformat.enableLint', async () => {
			vscode.workspace.getConfiguration('pythonformat').update('lint', true, true);
		}),
		vscode.commands.registerCommand('pythonformat.disableLint', () => {
			vscode.workspace.getConfiguration('pythonformat').update('lint', false, true);
			for (let i in documentStates) {
				docState = documentStates[i];
				if (docState.lastDecors) {
					safe(() => docState.lastDecors.forEach(([decor, ranges]) => docState.editor?.setDecorations(decor, [])));
				}
			}
		})
	);


	// outputChannel = vscode.window.createOutputChannel("PyPlayground");
	// statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
	// statusBarItem.command = "pythonformat.showOptions"; // Replace with your command name
	// statusBarItem.text = `PyHelper`;
	// statusBarItem.tooltip = "Enabled. Tap for more options";


	if (vscode.window.activeTextEditor?.document?.languageId != "python") {
		// statusBarItem.hide();
	} else {
		// statusBarItem.show();
		lint(vscode.window.activeTextEditor?.document);
	}



	(async () => {
		extensionPath = context.extensionPath;

		['python'].forEach((lang) => {
			context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(lang, {
				provideDocumentFormattingEdits(document, options, token) {
					const text = document.getText();
					const cmd_args = vscode.workspace.getConfiguration('pythonformat').get('formatargs', '') || '--line-width=88 --indent_style=space';
					let [formattedText, err] = format(text);
					if (err || !formattedText) {
						vscode.window.showInformationMessage("Python Format + Lint: Error while trying to format.");
						return [];
					}

					return [
						vscode.TextEdit.replace(
							new vscode.Range(0, 0, document.lineCount, 0),
							formattedText
						)
					];
				}
			}));
		});


		vscode.workspace.onDidChangeTextDocument(event => {//txt change
			lint(event?.document);
		});
		vscode.window.onDidChangeActiveTextEditor((editor) => { //doc change
			lint(editor?.document);
		});


	})();

}

function deactivate() { }


function parseArgs(args) {
	try {

		const options = args.split(" ").reduce((acc, arg) => {
			// Ensure that the argument is in the correct format of --key=value
			if (!arg.startsWith("--") || !arg.includes("=")) {
				throw new Error(`Invalid argument format: ${arg}. Expected format is --key=value.`);
			}

			const [key, value] = arg.replace("--", "").split("=");

			// Handle missing values (e.g., --key= without a value)
			if (value === undefined) {
				throw new Error(`Missing value for key: ${key}`);
			}

			// Clean up the key to camelCase (if needed)
			const formattedKey = key.replace(/_/g, ""); // This may be changed if the key should be in camelCase

			// Handle number parsing and add validation
			const parsedValue = isNaN(value) ? value : Number(value);

			// Validate parsed number values
			if (!isNaN(parsedValue) && parsedValue <= 0) {
				throw new Error(`Invalid value for ${formattedKey}: must be a positive number.`);
			}

			acc[formattedKey] = parsedValue;
			return acc;
		}, {});

		return options;
	} catch (error) {
		return {}
	}

}


module.exports = {
	activate,
	deactivate
}


function safe(fn, onError = () => { }) {
	try {
		let res = fn();
		if (res instanceof Promise) {
			return (async (resolve, reject) => {
				try {
					return (await res);
				} catch (e) {
					if (onError) onError(e);
					console.error(e);
					return null;
				}
			})();
		} else {
			return res;
		}
	} catch (e) {
		if (onError) onError(e);
		console.error(e);
		return null;
	}
}


function lint(document, edtr = null) {
	if (!document) return;
	if (!vscode.workspace.getConfiguration().get('pythonformat.lint')) return;
	let editor = edtr || vscode.window.activeTextEditor;
	if (!editor) return;
	if (!(document.languageId == 'python')) return;
	const text = document.getText();
	console.log(documentStates[document.uri.fsPath]);
	if (documentStates[document.uri.fsPath]?.text == text) {
		if (documentStates[document.uri.fsPath]?.lastDecors) {
			allDecors = [...documentStates[document.uri.fsPath].lastDecors];
			allDecors.forEach(([decor, ranges]) => editor.setDecorations(decor, ranges));
		}
		return;
	};
	allDecors.forEach(([decor, ranges]) => editor.setDecorations(decor, []));
	allDecors = [];
	documentStates[document.uri.fsPath] = { text };
	let [diagnostics, err] = check(text);
	if (err || !diagnostics) {
		vscode.window.showInformationMessage("PythPython Format + Lint: Error while trying to lint.");
		return;
	}
	for (let i in diagnostics) {
		d = diagnostics[i];
		let { row, column } = d.location;
		let message = d.message;

		const line = document.lineAt(row - 1);
		const startPosition = new vscode.Position(line.range.start.line, line.range.end.character);
		const endPosition = new vscode.Position(startPosition.line, line.range.end.character);
		const range = new vscode.Range(startPosition, endPosition);

		let decor = vscode.window.createTextEditorDecorationType({
			// backgroundColor: 'rgba(255, 0, 0, 0.2)',
			// overviewRulerColor: 'orange',	
			after: {
				margin: '0 0 0 1em',
				color: 'orange'
			},
		});
		let rngs = [
			{
				range,
				renderOptions: {
					after: {
						contentText: message,
					},
				},
			},
			{
				range,
				hoverMessage: message,
			}
		]
		allDecors.push([decor, rngs]);
	}
	allDecors.forEach(([decor, ranges]) => editor.setDecorations(decor, ranges));
	documentStates[document.uri.fsPath].editor = editor;
	documentStates[document.uri.fsPath].document = document;
	documentStates[document.uri.fsPath].lastDecors = [...allDecors];

	return true;
}