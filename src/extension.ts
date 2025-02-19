/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { readFile } from 'node:fs/promises';
import { basename, relative } from 'node:path';

let myStatusBarItem: vscode.StatusBarItem;

async function updateStatusBarItem(): Promise<any> {
  const { filepath } = await getCurrentFilenameAndPath();
  const includes = await getSnippetIncludes();
  const isSnippetOrSection = testIfSnippetOrSection(filepath);

  if (!isSnippetOrSection) {
    return myStatusBarItem.hide();
  }

   if (includes.length === 0) {
    myStatusBarItem.text = `⚠️ Not included anywhere`;
  } else {
    myStatusBarItem.text = `⬇ Included in...`;
  }

  return myStatusBarItem.show();
}

async function getSnippetIncludes(): Promise<Array<string>> {
  const { filename, filepath } = getCurrentFilenameAndPath();
  const isSnippetOrSection = testIfSnippetOrSection(filepath);

  if (!filename || !filepath || !isSnippetOrSection) {
    return [];
  }

  const includes = await findSnippetSectionIncludes(filename);
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (workspaceFolders) {
    const rootDirPath = workspaceFolders[0].uri.path;
    return includes.map((include: {path: string}) => relative(rootDirPath, include.path));
  }

  return includes;
}

function getCurrentFilenameAndPath(): { filename: string, filepath: string } {
  const activeTextEditor = vscode.window.activeTextEditor;
  const filepath = activeTextEditor && activeTextEditor.document.fileName || '';
  const filename = activeTextEditor && basename(filepath) || '';

  return { filename, filepath };
}

async function findSnippetSectionIncludes(filename: string): Promise<Array<any>> {
  const snippetSectionName = basename(filename, '.liquid');
  const liquidFiles = await vscode.workspace.findFiles('**/*.liquid');

  const liquidFileWithContents = await Promise.all(
    liquidFiles.map(async (liquidFile) => {
      const contents = await readFile(liquidFile.path);
      return { ...liquidFile, contents };
    })
  );

  return liquidFileWithContents.filter((result) => {
    const regex = `(include|render|section)\\s+[\'\"]${snippetSectionName}[\'\"]`;
    const snippetIncludeRegex = new RegExp(regex, 'gim');
    const contentsString = result.contents.toString();
    return snippetIncludeRegex.test(contentsString);
  });
}

function testIfSnippetOrSection(filepath: string): boolean {
  return filepath.includes('/snippets/') || filepath.includes('/sections/');
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate({ subscriptions }: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  // console.log('Congratulations, your extension "liquid-snippet-include-detection" is now active!');

	// register a command that is invoked when the status bar
	// item is selected
	const myCommandId = 'liquidSnippetIncludeDetection';

  // Now provide the implementation of the command with registerCommand
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

// This method is called when your extension is deactivated
export function deactivate() {}
