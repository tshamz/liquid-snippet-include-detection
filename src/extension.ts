/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { readFile } from 'fs';
import * as vscode from 'vscode';
import { basename, extname, relative } from 'path';

let myStatusBarItem: vscode.StatusBarItem;

async function updateStatusBarItem(): Promise<any> {
  const { filepath } = await getCurrentFilenameAndPath();
  const includes = await getSnippetIncludes();

  if (!fileIsSnippet(filepath)) {
    myStatusBarItem.hide();
    return;
  }

   if (includes.length === 0) {
    myStatusBarItem.text = `⚠️ Not included anywhere`;
    myStatusBarItem.show();
    return;
  }

  myStatusBarItem.text = `⬇ Included in...`;
  myStatusBarItem.show();
  return;
}

async function getSnippetIncludes(): Promise<Array<string>> {
  const { filename, filepath } = getCurrentFilenameAndPath();

  if (!filename || !filepath) return [];

  const includes = await findSnippetIncludes(filename);
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (workspaceFolders) {
    const rootDirPath = workspaceFolders[0].uri.path;
    const paths = includes.map(include => relative(rootDirPath, include.path));
    return paths;
  }

  return includes;
}

function getCurrentFilenameAndPath(): { filename: string, filepath: string } {
  const activeTextEditor = vscode.window.activeTextEditor;
  const filepath = activeTextEditor && activeTextEditor.document.fileName || '';
  const filename = activeTextEditor && basename(filepath) || '';

  return { filename, filepath };
}

function fileIsSnippet(filepath: string): Boolean {
  const isLiquidFile = extname(filepath) === '.liquid';
  const inSnippetDirectory = filepath.includes('/snippets/');

  return inSnippetDirectory && isLiquidFile;
}

async function findSnippetIncludes(filename: string): Promise<Array<any>> {
  const snippetName = basename(filename, '.liquid');
  const liquidFiles = await vscode.workspace.findFiles('**/*.liquid');
  const liquidFileContents = liquidFiles.map(async liquidFile => {
    const contents = await readLiquidFile(liquidFile.path);
    return { ...liquidFile, contents };
  });
  const results = await Promise.all(liquidFileContents);
  const matches = results.filter(result => {
    const snippetIncludeRegex = new RegExp('{\%\\s+include\\s+[\'\"]'+ snippetName +'[\'\"]', 'gim');
    return snippetIncludeRegex.test(result.contents);
  });

  return matches;
}

function readLiquidFile(filepath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    readFile(filepath, 'utf8', (err, data) => {
      if (err) reject(err);
      resolve(data);
    })
  })
};

export function activate({ subscriptions }: vscode.ExtensionContext) {
	// register a command that is invoked when the status bar
	// item is selected
	const myCommandId = 'sample.showSelectionCount';
  subscriptions.push(vscode.commands.registerCommand(myCommandId, async () => {
    const paths = await getSnippetIncludes();
    const message = `Included in: ${paths.join(', ')}`;

    if (paths.length > 0) {
      vscode.window.showInformationMessage(message);
    }
  }));

	// create a new status bar item that we can now manage
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	myStatusBarItem.command = myCommandId;
	subscriptions.push(myStatusBarItem);

	// register some listener that make sure the status bar
	// item always up-to-date
	subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem));

	// update status bar item once at start
	updateStatusBarItem();
}
