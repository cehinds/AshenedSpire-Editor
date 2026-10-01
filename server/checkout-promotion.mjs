import {lstat, rename} from 'node:fs/promises';
import path from 'node:path';

const RETRY_DELAYS = [100, 250, 500, 1000, 2000, 2000];
const fail = (status, message) => {throw Object.assign(new Error(message), {status});};
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

// Git completion waits for the child's close event. Windows can still briefly
// retain a directory handle (for example, while scanning the new checkout).
export async function promoteCheckoutStage(stage, target, {reposRoot, validateParent = async () => {}, platform = process.platform, renameOperation = rename, wait = pause} = {})
{
    const root = path.resolve(reposRoot);
    stage = path.resolve(stage); target = path.resolve(target);
    const repoId = path.basename(target);
    const stageName = path.basename(stage), stagePrefix = `${repoId}.clone-`;
    if (path.dirname(stage) !== root || path.dirname(target) !== root || !/^[a-z0-9][a-z0-9_.-]{0,145}$/.test(repoId) || !stageName.startsWith(stagePrefix) || !/^[a-f0-9]{16}$/.test(stageName.slice(stagePrefix.length))) fail(403, 'Checkout promotion requires its owned staging directory and repository target.');
    for (let attempt = 0; ; attempt++)
    {
        await validateParent();
        for (const directory of [root, stage])
        {
            const entry = await lstat(directory);
            if (!entry.isDirectory() || entry.isSymbolicLink()) fail(403, 'Checkout promotion requires real directories.');
        }
        let occupied = false;
        try {await lstat(target); occupied = true;} catch (error) {if (error.code !== 'ENOENT') throw error;}
        if (occupied) fail(409, 'Checkout target appeared during import; existing files were preserved.');
        try {await renameOperation(stage, target); return;}
        catch (error)
        {
            if (platform !== 'win32' || !['EPERM', 'EACCES'].includes(error.code) || attempt >= RETRY_DELAYS.length) throw error;
            await wait(RETRY_DELAYS[attempt]);
        }
    }
}
