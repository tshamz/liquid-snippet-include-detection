/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { readFile } from 'fs';
import * as vscode from 'vscode';
import { basename, extname, relative } from 'path';

let myStatusBarItem: vscode.StatusBarItem;

async function updateStatusBarItem(): Promise<any> {
  const { filepath } = await getCurrentFilenameAndPath();
  const context = getLiquidFileType(filepath);
  const includes = await getSnippetIncludes();

  if (!context) {
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
  const type = getLiquidFileType(filepath);

  if (!filename || !filepath || !type) return [];

  const includes = await findSnippetSectionIncludes(filename, type);
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (workspaceFolders) {
    const rootDirPath = workspaceFolders[0].uri.path;
    const paths = includes.map((include: {path: string}) => relative(rootDirPath, include.path));
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

async function findSnippetSectionIncludes(filename: string, type: string): Promise<Array<any>> {
  const snippetSectionName = basename(filename, '.liquid');
  const liquidFiles = await vscode.workspace.findFiles('**/*.liquid');

  const liquidFileWithContents = await Promise.all(
    liquidFiles.map(async liquidFile => {
      const contents = await readLiquidFile(liquidFile.path);
      return { ...liquidFile, contents };
    })
  );

  return liquidFileWithContents.filter(result => {
    const regex = `{\%-?\\s+${type === 'snippet' ? 'include' : 'section'}\\s+[\'\"]${snippetSectionName}[\'\"]`;
    const snippetIncludeRegex = new RegExp(regex, 'gim');
    return snippetIncludeRegex.test(result.contents);
  });
}

function getLiquidFileType(filepath: string): string | void {
  if (filepath.includes('/snippets/')) {
    return 'snippet';
  } else if (filepath.includes('/sections/')) {
    return 'section';
  }

  return;
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
	const myCommandId = 'liquidSnippetIncludeDetection';

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
