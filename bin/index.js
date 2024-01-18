#!/usr/bin/env node

const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const childProcess = require('child_process');
const yargs = require('yargs/yargs');
const os = require('os');

const { hideBin } = require('yargs/helpers');
const { initial } = require('lodash');

const configFile = path.join(__dirname, 'config.json');

const loadConfig = async () => {
    await checkForUpdates();

    try {
        const configData = await fs.readFile(configFile, 'utf-8');
        return JSON.parse(configData);
    } catch (error) {
        throw new Error('Failed to load config.json: ' + error.message);
    }
};

const saveConfig = async (config) => {
    await checkForUpdates();

    try {
        await fs.writeFile(configFile, JSON.stringify(config, null, 2));
    } catch (error) {
        throw new Error('Failed to save config.json: ' + error.message);
    }
};

const executeCommand = util.promisify(childProcess.exec);

const initialize = async () => {
    await checkForUpdates();

    const config = await loadConfig();

    if (config.initialized) {
        console.log('Flow manager is already initialized.');
        return;
    }

    const terminalProfileAnswer = await inquirer.prompt({
        type: 'list',
        name: 'terminalProfile',
        message: 'Select your terminal profile:',
        choices: ['bash', 'zsh', 'powershell', 'cmd'],
        default: 'bash',
    });

    const flowLocationAnswer = await inquirer.prompt({
        type: 'input',
        name: 'flowLocation',
        message: 'Enter the path where flows will be stored:',
        default: config.flowDir.replace("$USER_HOME", os.homedir()),
    });

    config.terminalProfile = terminalProfileAnswer.terminalProfile;
    config.flowDir = flowLocationAnswer.flowLocation;
    config.flowCommandDir = path.join(config.flowDir, 'commands')
    config.initialized = true;

    await saveConfig(config);
    console.log('Flow manager initialized successfully!');
};

const createFlow = async (flowNameEntry = null) => {
    await checkForUpdates();

    const config = await loadConfig();

    if (!config.initialized) {
        console.log('Flow manager is not initialized. Please run "flow init" to initialize it.');
        return;
    }

    if(!flowNameEntry){
        const flowNameEntry= await inquirer.prompt({
        type: 'input',
        name: 'flowName',
        message: 'Enter flow name:',
        validate: (value) => {
            try {
                if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
                    return 'Please enter a valid flow name';
                }
                //check if flow name already exists
                const flows = loadFlows();
                const flow = flows.find((f) => f.name === value);
                if (flow) {
                    return 'Flow name already exists';
                }
                return true;
            }
            catch (error) {
                return 'Please enter a valid flow name';
            }
        },
    });
    }
    const questions = [
        flowNameEntry,
        {
            type: 'input',
            name: 'flowName',
            message: 'Enter flow name:',
            validate: (value) => {
                try {
                    if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
                        return 'Please enter a valid flow name';
                    }
                    //check if flow name already exists
                    const flows = loadFlows();
                    const flow = flows.find((f) => f.name === value);
                    if (flow) {
                        return 'Flow name already exists';
                    }
                    return true;
                }
                catch (error) {
                    return 'Please enter a valid flow name';
                }
            },
        },
        {
            type: 'input',
            name: 'flowPath',
            message: 'Enter the path where the flow will be called from:',
            default: path.join(process.cwd(), config.defaultFlowPath),
            validate: async (value) => {
                try {
                    const stats = await fs.stat(value);
                    return stats.isDirectory() || 'Please enter a valid directory path';
                } catch (error) {
                    return 'Please enter a valid path';
                }
            },
        },
        {
            type: 'input',
            name: 'commands',
            message: 'Enter the commands to run (comma separated):',
        },
    ];

    const answers = await inquirer.prompt(questions);
    const { flowName, flowPath, commands } = answers;

    let scriptContent = '';
    let scriptFileExtension = '';

    switch (config.terminalProfile) {
        case 'bash':
            scriptContent = `#!/bin/bash\n\n${commands.replaceAll(',', '\n\n')}`;
            scriptFileExtension = '.sh';
            break;
        case 'zsh':
            scriptContent = `#!/bin/zsh\n\n${commands.replaceAll(',', '\n\n')}`;
            scriptFileExtension = '.sh';
            break;
        case 'powershell':
            // PowerShell script content
            scriptContent = `# PowerShell script content here\n\n${commands.replaceAll(',', '\n')}`;
            scriptFileExtension = '.ps1';
            break;
        case 'cmd':
            // CMD (batch script) content
            scriptContent = `@echo off\n\n${commands.replaceAll(',', '\n')}`;
            scriptFileExtension = '.bat';
            break;
        default:
            console.log('Invalid terminal profile selected.');
            return;
    }


    const commandFolder = path.join(config.flowCommandDir, flowName);

    try {
        await fs.mkdir(commandFolder, { recursive: true });
        const scriptFile = path.join(commandFolder, `script${scriptFileExtension}`);
        await fs.writeFile(scriptFile, scriptContent);

        const flows = await loadFlows();
        flows.push({
            name: flowName,
            path: flowPath,
            script: scriptFile,
        });

        await saveFlows(flows);

        console.log(`Flow created successfully! File location: ${scriptFile}`);
    } catch (error) {
        console.error('Error creating flow:', error.message);
    }
};

const listFlows = async () => {
    await checkForUpdates();

    const config = await loadConfig();

    if (!config.initialized) {
        console.log('Flow manager is not initialized. Please run "flow init" to initialize it.');
        return;
    }

    const flows = await loadFlows();
    if (flows.length === 0) {
        console.log('No flows found.');
    } else {
        console.log('List of flows:');
        flows.forEach((flow) => {
            console.log(flow.name);
        });
    }
};

const runFlow = async (flowName) => {
    await checkForUpdates();

    const config = await loadConfig();

    if (!config.initialized) {
        console.log('Flow manager is not initialized. Please run "flow init" to initialize it.');
        return;
    }

    const flows = await loadFlows();
    const flow = flows.find((f) => f.name === flowName);

    if (!flow) {
        console.log('Flow not found');
        return;
    }

    const currentDir = process.cwd();
    process.chdir(flow.path);

    console.log('Running flow: ' + flow.name);

    try {
        const { stdout, stderr } = await executeCommand(`sh ${flow.script}`);
        console.log(stdout);
        if (stderr) {
            console.error(stderr);
        }
    } catch (error) {
        console.error('Error running flow:', error.message);
    } finally {
        process.chdir(currentDir);
        console.log('Finished.');
    }
};

const deleteFlow = async (flowName) => {
    await checkForUpdates();

    const config = await loadConfig();

    if (!config.initialized) {
        console.log('Flow manager is not initialized. Please run "flow init" to initialize it.');
        return;
    }

    const flows = await loadFlows();
    const flowIndex = flows.findIndex((f) => f.name === flowName);

    if (flowIndex === -1) {
        console.log('Flow not found');
        return;
    }

    const flow = flows[flowIndex];

    try {
        await fs.rm(flow.script, { recursive: true });
        flows.splice(flowIndex, 1);
        await saveFlows(flows);

        console.log('Flow deleted successfully!');
    } catch (error) {
        console.error('Error deleting flow:', error.message);
    }
};

const loadFlows = async () => {
    await checkForUpdates();

    try {
        const config = await loadConfig();
        const flowsFile = path.join(config.flowDir, 'flows.json');

        if (!await fs.access(flowsFile).then(() => true).catch(() => false)) {
            return [];
        }

        const flowsData = await fs.readFile(flowsFile, 'utf-8');
        return JSON.parse(flowsData);
    } catch (error) {
        console.error('Error loading flows:', error.message);
        return [];
    }
};

const saveFlows = async (flows) => {
    const config = await loadConfig();
    const flowsFile = path.join(config.flowDir, 'flows.json');

    try {
        await fs.writeFile(flowsFile, JSON.stringify(flows, null, 2));
    } catch (error) {
        console.error('Error saving flows:', error.message);
    }
};

const reinitialize = async () => {
    await checkForUpdates();

    // give user option to move flows to new location, or delete them, or cancel
    // if move, ask for new location
    // if delete, delete flows and ask for new location
    // if cancel, cancel

    const COMPLETED_MOVE = "Flows moved successfully!\n\nNew location:"
    const config = await loadConfig();

    //check if existing flows exist
    const flows = await loadFlows();
    if (flows.length > 0) {
        const verificationAnswer = await inquirer.prompt({
            type: 'list',
            name: 'verification',
            message: 'You are about to reinitialize the flow manager. What would you like to do with existing flows?',
            choices: ['Move To New Location', 'Delete Existing Flows', 'Cancel'],
            default: 'Move To New Location',
        });

        switch (verificationAnswer.verification) {
            case 'Move To New Location':
                const newFlowLocationAnswer = await inquirer.prompt({
                    type: 'input',
                    name: 'flowLocation',
                    message: 'Enter the path where flows will be stored:',
                    default: config.flowDir.replace("$USER_HOME", os.homedir()),
                });
                //move flow folder to new location recursively
                const execSync = require('child_process').execSync;
                switch (config.terminalProfile) {
                    case 'bash':
                    case 'zsh':
                        execSync(`mv ${config.flowDir} ${newFlowLocationAnswer.flowLocation}; echo ${COMPLETED_MOVE}${newFlowLocationAnswer.flowLocation}`);
                        break;
                    case 'powershell':
                        execSync(`Move-Item -Path ${config.flowDir} -Destination ${newFlowLocationAnswer.flowLocation}; echo ${COMPLETED_MOVE}${newFlowLocationAnswer.flowLocation}`);
                        break;
                    case 'cmd':
                        execSync(`move ${config.flowDir} ${newFlowLocationAnswer.flowLocation}; echo ${COMPLETED_MOVE}${newFlowLocationAnswer.flowLocation}`);
                        break;
                    default:
                        console.log('Invalid terminal profile selected.');
                }
                //update config
                config.flowDir = newFlowLocationAnswer.flowLocation;
                config.flowCommandDir = path.join(config.flowDir, 'commands')
                config.initialized = true;
                await saveConfig(config);
                break;
            case 'Delete Existing Flows':
                //delete flows folder
                const exec = require('child_process').exec;

                switch (config.terminalProfile) {
                    case 'bash':
                    case 'zsh':
                        exec(`rm -rf ${config.flowDir}`);
                        break;
                    case 'powershell':
                        exec(`Remove-Item -Recurse -Force ${config.flowDir}`);
                        break;
                    case 'cmd':
                        exec(`rmdir /s /q ${config.flowDir}`);
                        break;
                    default:
                        console.log('Invalid terminal profile selected.');
                        return;
                }

                //update config
                config.initialized = false;
                await saveConfig(config);

                //reinitialize
                await initialize();
                break;
            case 'Cancel':
                return;
        }
    }
}

const openFlowForEditing = async (flowName) => {
    await checkForUpdates();
    const config = await loadConfig();

    if (!config.initialized) {
        console.log('Flow manager is not initialized. Please run "flow init" to initialize it.');
        return;
    }

    const flows = await loadFlows();
    const flow = flows.find((f) => f.name === flowName);

    if (!flow) {
        console.log('Flow not found');
        return;
    }

    const currentDir = process.cwd();
    process.chdir(flow.path);

    console.log('Opening flow for editing: ' + flow.name);

    try {
        const { stdout, stderr } = await executeCommand(`code ${flow.script}`);
        console.log(stdout);
        if (stderr) {
            console.error(stderr);
        }
    } catch (error) {
        console.error('Error opening flow for editing:', error.message);
    } finally {
        process.chdir(currentDir);
        console.log('Finished.');
    }
}

const checkForUpdates = async () => {
    const { stdout, stderr } = await executeCommand('npm view scriptflow-cli version');
    const latestVersion = stdout.trim();

    if (latestVersion !== require('../package.json').version) {
        console.log('A new version of scriptflow-cli is available. Run "npm i -g scriptflow-cli" to update.');
    }
}

const resetConfig = async () => {
    const config = await loadConfig();
    config.flowDir = path.join(os.homedir(), '.flow');
    config.flowCommandDir = path.join(config.flowDir, 'commands')
    config.terminalProfile = 'bash';
    config.defaultFlowPath = '.';
    config.initialized = false;
    await saveConfig(config);
}

yargs(hideBin(process.argv))
    .command('init', 'Initialize the flow manager', {}, initialize)
    .command('create', 'Create a new flow', {}, createFlow)
    .command('list', 'List all flows', {}, listFlows)
    .command('run <flowName>', 'Run a flow by name', {}, (argv) => runFlow(argv.flowName))
    .command('delete <flowName>', 'Delete a flow by name', {}, (argv) => deleteFlow(argv.flowName))
    .command('reinit', 'Reinitialize the flow manager', {}, reinitialize)
    .command('edit <flowName>', 'Open a flow for editing', {}, (argv) => openFlowForEditing(argv.flowName))
    .command('default', 'Reset the flow manager config', {}, resetConfig)
    .demandCommand()
    .help()
    .argv;
