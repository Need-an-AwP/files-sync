import chokidar from 'chokidar';
import { exec } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';
import { access, constants, stat } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

// Get environment variables
const sourceDir = process.env.SOURCE_DIR?.trim().replace(/^["'](.+)["']$/, '$1');
const targetDir = process.env.TARGET_DIR?.trim().replace(/^["'](.+)["']$/, '$1');
const isFullCopy = process.env.FULLCOPY?.toLowerCase() === 'true';

// Validate required environment variables
if (!targetDir) {
    console.error(chalk.red('Error: TARGET_DIR is not set in .env file'));
    process.exit(1);
} else if (!sourceDir) {
    console.error(chalk.red('Error: SOURCE_DIR is not set in .env file'));
    process.exit(1);
}

// Validate paths
async function validatePaths() {
    try {
        // Check source path
        await access(sourceDir, constants.F_OK);
        const sourceStats = await stat(sourceDir);
        if (!sourceStats.isDirectory()) {
            throw new Error('SOURCE_DIR is not a directory');
        }

        // Check target path
        await access(targetDir, constants.F_OK);
        await access(targetDir, constants.W_OK);
        const targetStats = await stat(targetDir);
        if (!targetStats.isDirectory()) {
            throw new Error('TARGET_DIR is not a directory');
        }
    } catch (error) {
        switch (error.code) {
            case 'ENOENT':
                console.log(chalk.yellow(`Path does not exist: ${error.path}`));
                break;
            case 'EACCES':
                console.log(chalk.yellow(`Access denied: ${error.path}`));
                break;
            default:
                console.log(chalk.yellow(`Error: ${error.message}`));
        }
        process.exit(1);
    }
}

await validatePaths();

// Ignored patterns for file watching
const ignore = [
    '**/node_modules/**',
    '**/dist/**',
    '**/release/**',
    '**/.git/**',
    '.env'
];

console.log(chalk.yellow('Ignoring the following patterns:'), ignore);

// Execute sync script
function runSync() {
    console.log(chalk.yellow('Starting file synchronization...'));

    const psCommand = `
        $ErrorActionPreference = 'Continue';
        $VerbosePreference = 'Continue';
        try {
            & "${path.join(__dirname, 'sync.ps1')}" -sourceDir "${sourceDir}" -baseDestination "${targetDir}" ${isFullCopy ? '-FullCopy' : ''};
            if ($LASTEXITCODE -gt 3) { throw "Robocopy failed with exit code $LASTEXITCODE" }
        } catch {
            Write-Error $_;
            exit 1;
        }
    `;

    const command = `powershell -Command "${psCommand}"`;

    exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
            console.error(chalk.red(`Error executing sync script: ${error.message}`));
            return;
        }
        if (stderr) {
            console.error(chalk.red(`Sync script stderr: ${stderr}`));
        }
        console.log(stdout);
        console.log(chalk.green('File synchronization completed'));
    });
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Create debounced version of sync function
const debouncedSync = debounce(runSync, 1000);

// Initialize file watcher
console.log(chalk.blue('Initializing file watcher...'));
console.log(chalk.blue(`Watching directory: ${sourceDir}`));
console.log(chalk.blue(`Destination: ${targetDir}`));
console.log(chalk.blue(`Full copy mode: ${isFullCopy ? 'enabled' : 'disabled'}`));

const watcher = chokidar.watch(sourceDir, {
    ignored: ignore,
    persistent: true,
    ignoreInitial: true,
    usePolling: true,  // 使用轮询方式
    interval: 1000, 
    awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
    }
});

// Watch file changes
watcher
    .on('add', path => {
        console.log(chalk.green(`File ${path} has been added`));
        debouncedSync();
    })
    .on('change', path => {
        console.log(chalk.yellow(`File ${path} has been changed`));
        debouncedSync();
    })
    .on('unlink', path => {
        console.log(chalk.red(`File ${path} has been removed`));
        debouncedSync();
    })
    .on('ready', () => {
        console.log(chalk.green('Initial scan complete. Running first sync...'));
        runSync();
    })
    .on('error', error => {
        console.error(chalk.red(`Watcher error: ${error}`));
    });

// Graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\nClosing file watcher...'));
    watcher.close().then(() => {
        console.log(chalk.green('File watcher closed'));
        process.exit(0);
    });
});
