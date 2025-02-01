# Files Sync Tool for test in hyper-V

## prevent powershell display error(optional)
enable global UTF-8 support to avoid chinese display as error code in power shell
https://stackoverflow.com/a/57134096/20001298
if the language of annotation in ps script is not English, then unicode setting must be enabled

## hyper-V Windows configuration
### Windows version requirement
till 2025 Jan, windows 11 still has serious SMB problem, even if the host and hyperV are both windows 11, the file share function stll needs the SMB 1.0 enabled
my testing environment is windows 10 for both host and hyperV, no need extra configuration

### installation list
- nodejs>=20
- vscode(optional)
- git

### enable yarn
```bash
corepack enable
```
### allow ps script to run(run in admin)
```powershell
Set-ExecutionPolicy RemoteSigned
```
### connect host disk to hyper-V
- enable the host's share dirve when connecting to hyper-V
- map the network path as a new drive in hyper-V (like Z:\)
> cause the chokidar couldn't watch network path(SMB), so the chokidar is also set to polling mode

DO NOT use network path like "\\tsclient\C\XXX"
even though robocopy can work with network path, but chokidar couldn't watch the network path

## file watcher
it get params from .env file and pass them to ps script

the full copy mode means that it will copy everything from this project to the destination

enable full copy mode then you can run dev in hyper-V without setting other things

full copy mode is enabled by default

In chokidar 4.x, glob is removed

## watch ignore list
- node_modules
- dist
- release
- .git
- tests/files-sync
- .env
  
## copy ignore list
(in full copy mode only .git is ignored)
- node_modules
- release
- dist
- .git

## run
clone this repo into hyper-V, and write the sourceDir and targetDir in .env file

```bash
yarn start
```
or
```bash
node watcher.js
```

## final backup solution
use another independent node.js project in hyperV to watch the target folder in host machine, and copy it