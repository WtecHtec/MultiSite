import { dialog , ipcMain} from "electron";
import fs from 'fs/promises';
import path from 'path';
export const  ipcHandleSlectFolder = ( mainWindow: any) => {
    ipcMain.handle('select-folder', async () => {
        if (!mainWindow) return null;
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory'],
        });
        if (result.canceled) {
          return null;
        }
        return result.filePaths[0];
    });
}

export const  ipcHandleReadDirectory = ( mainWindow: any) => {
    ipcMain.handle('read-directory', async (_event, dirPath: string) => {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          return entries.map((entry) => ({
            name: entry.name,
            path: path.join(dirPath, entry.name),
            isDirectory: entry.isDirectory(),
          }));
        } catch (error) {
          console.error('Error reading directory:', error);
          throw error;
        }
    });
}


export const  ipcHandleReadFile = ( mainWindow: any) => {
    ipcMain.handle('read-file', async (_event, filePath: string) => {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          return content;
        } catch (error) {
          console.error('Error reading file:', error);
          throw error;
        }
    });
}