// index.ts
//   Main server-side entry point.

import { app } from 'electron';
import { Main } from "./main";

if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
    app.quit();
}

app.on('ready', () => {
    new Main();
});

app.on('window-all-closed', () => {
    app.quit();
});




 
