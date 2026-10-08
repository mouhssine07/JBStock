const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jbstock', {
  getCompany: () => ipcRenderer.invoke('company:get'),
  saveCompany: profile => ipcRenderer.invoke('company:save', profile),
  getLanguage: () => ipcRenderer.invoke('language:get'),
  setLanguage: language => ipcRenderer.invoke('language:set', language),
});
