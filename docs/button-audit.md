# Editor button audit

Audit date: 2026-10-01. Scope: all top-level editor JSX button/link declarations and data-generated action families across nine workspaces. Source review is exhaustive at declaration level; runtime evidence is distinguished below. Repeated records reuse their declared handler. Native ERD/game internals are separately bounded integrations, not a claim that every embedded application command was manually clicked.

This inventory records the shared authoring checkout at audit time, including concurrent card/workbook/sprite work. The scene-layout merge isolates scene composition, movable menus/dialogs, native dialog focus, and nonmutating navigation fixes. Other audited features have separate delivery branches; their inventory rows do not imply inclusion in this scene merge. Historical test counts below apply to that audited checkout; merge validation is recorded separately.

## Evidence and coverage

- Full declared npm test command passed on 2026-10-01, including native model/renderer/audio, local sessions and CSRF, isolated branch/file/build fixtures, native revision-check saves, XLSX import/export, and Pages packaging tests. No user checkout mutation or remote publication was performed.
- Initial dev URL http://127.0.0.1:5180/ returned the title but no editor within 60 seconds. Baseline production URL http://127.0.0.1:5181/ rendered immediately. Fresh-build browser checks are recorded separately below.
- Browser plugin was absent. Initial baseline used bundled Playwright and isolated headless Edge. Subsequent fresh-build checks use the requested CUA Chrome tab, separate from the main agent’s tab.
- Host write actions are source-reviewed and exercised by temporary test fixtures; not manually executed against the user’s connected checkout. Account UI is paused; no credentials were entered.

## Findings and fixes

| Finding | Owner / outcome |
|---|---|
| Window panel focus commands absent in Scenes Compose | Root assigned App studio focus routing. Verify fresh build. |
| Card studio Save/Add-to-game received missing callbacks | App callback wiring landed. Fresh CUA build: Add card to game opens the native checkout dialog; Save callback source verified. |
| Open animation binding changed authored binding and landed in prior pose mode | Fixed Views.jsx to navigate directly to Bindings without changing data. Fresh CUA build verified Poses → Bindings; Undo remained disabled. |
| Scene Words & sound allowed invalid cue strings and claimed all audio disconnected | Fixed Views.jsx with native choice dropdowns and accurate Compose audition guidance. |
| Dirty repository Browse files/Builds used two guards, overwriting pending repo selection | Fixed RepositoryWorkspace.jsx as one App openWorkspace transaction with selection callback. |
| Health/review claimed engine/Combat disconnected despite native preview | Root assigned label correction. |
| Native checkout dialog loses focus when Close is disabled during async load | Reproduced in CUA; fixed focusable dialog, busy/settled recovery, document Tab trap and visible control filtering. Final in-app browser check passed: focus retained after host check; Tab/Shift+Tab wrapped; Escape closed. |
| Older scene inspector limits duration to 60 instead of native 180 seconds | Fixed to native 1–180 range; scene model duration tests pass. |
| Local settings promotion still mentions authenticated host | Latest concurrent source already uses Local editor host wording. |
| Movable hook contained invalid object literal default shorthand | Reported immediately; root corrected before final build. |
| Canvas hit-area button responds only to pointer | Reported to SceneStudio owner for keyboard selection/playback fix. |

## Action families

| Surface | Action contract and verification boundary |
|---|---|
| Shell and menus | File import/export/save/review; Edit draft undo/redo/search; View modes/workspaces; Build local tools and validation; Window panel focus; Help dialogs. Dynamic menu items inherit EditorMenu keyboard navigation and movable/pinnable container handlers. |
| Cards | Native definition selection/edit/proposal review; base/upgrade; reviewed new card; artwork import; native card studio layers, tag assignment, save/export and explicit game addition. Source updates remain separate from sidecars. |
| Decks | Owned-copy limited add/remove, drop, validation, confirm, restore session; native card shelf pages and upgraded toggle. |
| Tags | Row/tree select, cycle-checked parent edits, explicit ERD import/map/review/apply, CSV, native ERD independent document and full-window link. |
| Scenes | Native scene selection/order/enable slots, stage and responsive actor edits, fitted canvas tools, play/pause/rewind/seek, text delay, audio audition/stop, library/inspector/timeline sizing and window placement. No arbitrary game sprite slots or seekable music promised. |
| Battlefield | Proposal-only sizing/device/compare; separate native game preview; JSON validation. |
| UI settings | Layout bands, reviewed named wireframes, snapshot update/export, JSON, native preview. |
| Poses | Play/pause/restart/speed/loop/seek, pose selection, replacement artwork, clip add/remove/timing, binding edits, native pose playback with supported binding. |
| Combat | Scenario fields, native encounter start/restart/class/card target/end turn; native save/load/menu callbacks explicitly explain isolated preview limitations. |
| Project | Local repository register/open/select; branch controls; hierarchy/file/revision save; declared build/test/install/cancel/log/artifact actions; native settings promotion; assets/source links/history/import/export. |
| Shared editors | Number step/reset, committed text, valid JSON apply; dialogs close/focus trap; recoverable conflict choices; reviewed XLSX/native checkout merge/save gates. |

## Exhaustive source declarations

221 interactive declarations across 20 JSX files. Regenerated from current source on 2026-10-01 after assigned fixes. Dynamic labels are shown as source expressions. A handler’s presence is source evidence, not browser proof. Control groups render additional repeated instances from actual records.

### App.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 69 | button | AshenedSpire | onClick: {()=>openWorkspace('project','Overview')} | — |
| 69 | button | {localHost.offline?'Public preview supports drafts and exports':'Refresh local editor connection'} | onClick: {localHost.refresh} | {localHost.offline\|\|localHost.checking} |
| 69 | button | Find anything | onClick: {()=>setDialog('search')} | — |
| 69 | button | Review changes | onClick: {()=>setDialog('review')} | — |
| 69 | button | [dynamic label] | onClick: {repositoryMode?exportProject:exportCurrent} | — |
| 69 | button | [dynamic label] | onClick: {()=>switchWs(id)} | — |
| 69 | button | Close | onClick: {()=>setLeftOpen(false)} | — |
| 69 | button | [dynamic label] | onDragStart: {e=>e.dataTransfer.setData('text/plain',q.id)}; onClick: {()=>q.isMode?ctx.setMode(q.id):choose(q.id)} | — |
| 69 | button | [dynamic label] | onClick: {()=>ctx.setMode(m)} | — |
| 69 | button | "Undo draft change" | onClick: {()=>setH(undo)} | {repositoryMode\|\|!h.past.length} |
| 69 | button | "Redo draft change" | onClick: {()=>setH(redo)} | {repositoryMode\|\|!h.future.length} |
| 69 | button | Library | onClick: {()=>setLeftOpen(true)} | — |
| 69 | button | Selection | onClick: {()=>setInspectorOpen(true)} | — |
| 69 | button | Resolve | onClick: {()=>setDialog('conflict')} | — |
| 69 | button | Close | onClick: {()=>setInspectorOpen(false)} | — |
| 73 | button | [dynamic label] | onClick: {()=>{switchWs(id);setDialog(null);}} | — |
| 73 | button | [dynamic label] | onClick: {()=>{switchWs('cards');choose(c.id,'cards');setDialog(null);}} | — |
| 73 | button | [dynamic label] | onClick: {()=>{switchWs('tags');choose(n.id,'tags');setDialog(null);}} | — |
| 73 | button | Reset local draft | onClick: {()=>{setH(v=>commit(v,baseline));setDialog(null);}} | — |
| 73 | button | Export this draft | onClick: {()=>download('AshenedSpire-conflict-copy.json',p)} | — |
| 73 | button | Load recovery | onClick: {()=>{setH(v=>commit(v,readInitial()));setConflict(false);setDialog(null);}} | — |
| 73 | button | Keep this tab explicitly | onClick: {()=>{try{localStorage.setItem(KEY,JSON.stringify(p));setConflict(false);setSaved('Saved locally');setDialog(null);}catch(e){tell(e.message);}}} | — |
| 73 | button | Apply reviewed card draft | onClick: {()=>{const q=dialog.value;update(n=>n.cards=n.cards.map(c=>c.id===q.id?q:c),'Reviewed card proposal applied locally');setDialog(null);}} | — |
| 73 | button | Export whole project | onClick: {()=>download('AshenedSpire-workbench.json',p)} | — |
| 73 | button | Import workbench package | onClick: {()=>importRef.current.click()} | — |
| 73 | button | Preview health | onClick: {()=>setDialog('health')} | — |

### AuthoringCreate.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 14 | button | New … | onClick: {start} | {open} |
| 18 | button | Create reviewed draft | onClick: {() => { commit(proposed); setOpen(false); }} | {!!issue} |
| 18 | button | Cancel creation | onClick: {() => setOpen(false)} | — |
| 41 | button | Apply reviewed wireframe | onClick: {() => { c.update(project => { project.ui = structuredClone(selected.config); }, 'Stored wireframe applied to current layout draft'); setReplaceReviewed(false); }} | {!replaceReviewed \|\| activeMatches} |
| 41 | button | Update snapshot from current layout | onClick: {() => c.update(project => { project.wireframes = project.wireframes.map(record => record.id === selected.id ? {...record, config: structuredClone(project.ui)} : record); }, 'Wiref | {activeMatches} |
| 41 | button | Export native layout JSON | onClick: {() => download(selected.id + '.json', selected.config)} | — |

### CardStudio.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 20 | button | Preview & edit in game | onClick: {()=>setMode('In game')} | — |
| 22 | button | Base definition | onClick: {()=>setUpgraded(false)} | — |
| 22 | button | Upgraded definition | onClick: {()=>setUpgraded(true)} | {!card.upgrade} |
| 34 | button | {`${tag.hidden?'Show':'Hide'} ${tag.label} in game`} | onClick: {()=>patch('tagVisibility',{...style.tagVisibility,[tag.id]:tag.hidden})} | — |
| 34 | button | {`Unassign ${tag.label}`} | onClick: {()=>setIds(tags.filter(t=>t.id!==tag.id).map(t=>t.id))} | — |
| 35 | button | Add | onClick: {()=>{setIds([...tags.map(t=>t.id),candidate]);setCandidate('');}} | {!candidate} |
| 36 | button | Restore source tags & visibility | onClick: {()=>update(n=>{const s=n.styles[card.id];if(s){delete s.tagIds;delete s.tagVisibility;delete s.categoryColors;delete s.hiddenTagColor;}})} | — |
| 52 | button | Readable card | onClick: {()=>ctx.setMode('Visual')} | — |
| 52 | button | Save full card draft | onClick: {ctx.saveDraft} | — |
| 52 | button | Export card object | onClick: {()=>{try{download(`${card.id}.card.json`,cardObject(p,card.id,assignments));tell('Full card object exported with artwork, layout and tags');}catch(e){setError(e.message);}}} | — |
| 52 | button | Import card object… | onClick: {()=>importInput.current.click()} | — |
| 52 | button | Add card to game… | onClick: {()=>ctx.openNativeCard?.(card.id)} | — |
| 53 | button | Apply reviewed card object | onClick: {()=>{try{const next=importCardObject(p,pending,{replace:true});update(n=>Object.assign(n,next),'Reviewed full card object imported');ctx.choose(pending.definition.id);setPending(n | — |
| 53 | button | Cancel import | onClick: {()=>setPending(null)} | — |
| 59 | button | [dynamic label] | onClick: {()=>setPanel(name)} | — |
| 61 | button | Add artwork / drop image | onClick: {()=>input.current.click()} | — |
| 62 | button | Add from path | onClick: {()=>{addArt(path.trim(),path.trim().split('/').at(-1));setPath('');}} | {!path.trim()} |
| 63 | button | [dynamic label] | onDragStart: {e=>e.dataTransfer.setData('application/x-card-layer',l.id)}; onClick: {()=>setSelected(l.id)} | — |
| 64 | button | Remove art layer | onClick: {()=>apply({...layout,layers:layout.layers.filter(l=>l.id!==layer.id)})} | — |
| 64 | button | Bring forward | onClick: {()=>moveOrder(1)} | {layout.layers.at(-1)?.id===layer.id} |
| 64 | button | Send back | onClick: {()=>moveOrder(-1)} | {layout.layers[0]?.id===layer.id} |
| 65 | button | Restore native layout | onClick: {()=>update(n=>{if(n.styles[card.id])delete n.styles[card.id].layout;},'Native layout restored')} | — |

### Controls.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 7 | button | {`Decrease ${label}`} | onClick: {()=>onChange(Math.max(min,value-step))} | {value<=min} |
| 7 | button | {`Increase ${label}`} | onClick: {()=>onChange(Math.min(max,value+step))} | {value>=max} |
| 7 | button | Reset to inherited value | onClick: {onReset} | — |
| 10 | button | Apply valid draft | onClick: {()=>{try{const p=JSON.parse(text),e=validate(p);if(e.length)throw new Error(e.join('; '));onApply(p);setError('');}catch(e){setError(e.message);}}} | — |

### EditorMenu.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 25 | div | {`Move ${menu.label} menu`} | — | — |
| 28 | button | {pinned ? `Unpin ${menu.label} menu` : `Pin ${menu.label} menu`} | onClick: {() => setPinned(value => !value)} | — |
| 29 | button | {`Reset ${menu.label} menu position`} | onClick: {movable.reset} | — |
| 30 | button | {`Close ${menu.label} menu`} | onClick: {() => close(true)} | — |
| 33 | button |  | onClick: {() => {if (!pinned) close(true); item.action();}} | {item.disabled} |
| 163 | button | [dynamic label] | onFocus: {() => setActive(index)}; onKeyDown: {event => triggerKeys(event, index)}; onClick: {() => open === index ? close(true) : show(index)} | — |

### GameCardPreview.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 118 | button | Previous | onClick: {()=>setPage(currentPage-1)} | {!currentPage} |
| 118 | button | Next | onClick: {()=>setPage(currentPage+1)} | {currentPage===maxPage} |

### GameRuntimePreview.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 104 | button | Restart encounter | onClick: {() => { setMessage('Restarting native encounter…'); setRestart(value => value + 1); }} | — |

### GameSettings.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 46 | button | Import native settings JSON | onClick: {() => input.current.click()} | — |
| 46 | button | Export native settings JSON | onClick: {() => {try {download('AshenSpire-settings.json', exportGameSettings(value)); ctx.tell('Native settings JSON exported');} catch (problem) {setError(problem.message);}}} | — |
| 49 | button | [dynamic label] | onClick: {() => setMode(name)} | — |
| 55 | a | advancedConfig.js | href: {SOURCE+'/src/model/advancedConfig.js'} | — |
| 56 | a | isLiveXpSetting | href: {SOURCE+'/src/model/advancedConfig.js'} | — |
| 57 | a | settingsSync.js | href: {SOURCE+'/src/model/settingsSync.js'} | — |
| 58 | a | settings-defaults.mjs | href: {SOURCE+'/tools/settings-defaults.mjs'} | — |
| 63 | a | Inspect native row | href: {SOURCE+'/'+KNOWN_SETTINGS.find(row => row.key === known)?.source} | — |
| 66 | button | [dynamic label] | — | — |
| 68 | button | Edit | onClick: {() => edit(entryKey)} | — |
| 68 | button | Remove | onClick: {() => apply(removeGameOverride(value, entryKey), 'Native override removed from draft')} | — |

### InGamePreview.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 20 | button | Retry preview | onClick: {() => this.setState({error: null})} | — |

### LocalBranches.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 115 | button | Refresh branches | onClick: {refresh} | {!available \|\| disabled \|\| Boolean(busy)} |
| 129 | button | Switch branch | onClick: {() => mutate('switch', {name: selected})} | {switchLocked \|\| !chosen \|\| chosen.current} |
| 130 | button | Review deletion | onClick: {() => setRemoveReview(selected)} | {locked \|\| !chosen \|\| chosen.current \|\| chosen.protected} |
| 139 | button | Create branch | — | {locked \|\| !name.trim() \|\| switchAfter && switchLocked} |
| 143 | button | Delete merged local branch | onClick: {() => mutate('delete', {name: removeReview})} | {locked} |
| 144 | button | Keep branch | onClick: {() => setRemoveReview(null)} | {Boolean(busy)} |

### LocalSettingsPromotion.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 131 | button | [dynamic label] | onClick: {load} | {busy \|\| job?.status === 'running'} |
| 134 | button | Promote reviewed settings into checkout | onClick: {promote} | {!reviewed \|\| busy \|\| job?.status === 'running'} |
| 137 | button | Inspect checkout files | onClick: {() => ctx.setMode?.('Files')} | — |
| 137 | button | Open builds and all job logs | onClick: {() => ctx.setMode?.('Builds')} | — |

### MovableDialog.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 12 | div | {`Move ${title} dialog`} | — | — |
| 13 | button | "Reset dialog position" | onClick: {movable.reset} | — |
| 14 | button | Close | onClick: {onClose} | — |

### NativeDocumentBridge.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 197 | button | Close | onClick: {onClose} | {busy} |
| 211 | button | [dynamic label] | onClick: {() => action(load)} | {busy \|\| !target.repoId} |
| 211 | button | [dynamic label] | onClick: {() => action(prepareReview)} | {busy \|\| !loaded \|\| !target.repoId} |
| 212 | button | Save reviewed native document | onClick: {() => action(save)} | {busy \|\| review.before === review.after} |

### NativePreviewFrame.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 102 | button | Full screen | onClick: {fullScreen} | — |

### RepositoryWorkspace.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 282 | button |  | onKeyDown: {event => treeKey(event, entry)}; onClick: {() => entry.type === 'directory' ? toggleDirectory(entry.path) : openFile(entry.path)} | {!!busy} |
| 332 | button | Discard edits and continue | onClick: {() => { const next = pending; setPending(null); setText(file?.content \|\| ''); next(); }} | — |
| 332 | button | Keep editing | onClick: {() => setPending(null)} | — |
| 338 | button | [dynamic label] | — | {!connected \|\| !!busy \|\| !url.trim()} |
| 342 | button | [dynamic label] | onClick: {() => action('connect:' + item.id, async () => { const result = await request(`/repos/${encodeURIComponent(item.id)}/connect`, {method: 'POST', body: '{}'}); await refreshRepos(); | {!connected \|\| !!busy} |
| 342 | button | Select repository | onClick: {() => selectRepo(item.id)} | {!connected \|\| !!busy} |
| 342 | button | Browse files | onClick: {() => openRepositoryMode(item.id, 'Files')} | {!!busy} |
| 342 | button | Builds | onClick: {() => openRepositoryMode(item.id, 'Builds')} | {!!busy} |
| 348 | button | Local repositories | onClick: {() => ctx.setMode?.('Repositories')} | — |
| 349 | button | Refresh root | onClick: {() => loadTree('')} | {!!treeBusy} |
| 350 | button | [dynamic label] | onClick: {() => action('save', async () => { const value = await request(`/repos/${encodeURIComponent(repoId)}/file`, {method: 'PUT', body: JSON.stringify({path: file.path, content: text, r | {!dirty \|\| !!busy \|\| running} |
| 350 | button | Reload current file | onClick: {() => guard(() => loadFile(file.path))} | {!!busy} |
| 353 | button | [dynamic label] | onClick: {() => startJob(name.startsWith('test') ? 'test' : 'build', name)} | {running \|\| !!busy \|\| !host.capabilities?.includes('builds')} |
| 353 | button | Install dependencies… | onClick: {() => setInstallReview(true)} | {running \|\| !!busy \|\| !git?.packageManager \|\| git?.canInstall === false \|\| !host.capabilities?.includes('builds')} |
| 354 | button | Execute package install | onClick: {() => startJob('install')} | {running \|\| !!busy} |
| 354 | button | Cancel | onClick: {() => setInstallReview(false)} | — |
| 357 | a | Open artifact | href: {artifact.url} | — |
| 357 | button | Preview built game | onClick: {() => setPreview({...artifact, origin: 'current'})} | — |
| 358 | button | Cancel running job | onClick: {() => action('cancel:' + job.id, async () => { await request(`/jobs/${encodeURIComponent(job.id)}/cancel`, {method: 'POST', body: '{}'}); setMessage('Cancellation requested. Waiti | {!!busy} |
| 358 | a | Open artifact | href: {artifact.url} | — |
| 358 | button | Preview built game | onClick: {() => setPreview({...artifact, jobId: job.id})} | — |
| 359 | button | Close preview | onClick: {() => setPreview(null)} | — |
| 368 | button | Save branch | — | {disabled \|\| value === (repo.branch \|\| '')} |

### ScenePreview.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 53 | button | Play preview | onClick: {() => launch(true)} | {!enabled} |
| 54 | button | [dynamic label] | onClick: {() => frame.current?.contentWindow?.postMessage({channel: channel.current, type: 'scene-command', command: status === 'Paused' ? 'resume' : 'pause'}, '*')} | {!enabled \|\| !['Playing', 'Paused'].includes(status)} |
| 55 | button | Restart | onClick: {() => launch(true)} | {!enabled} |
| 56 | button | Stop | onClick: {() => launch(false)} | {!enabled \|\| status === 'Ready'} |

### SceneStudio.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 55 | button | {label} | — | — |
| 167 | button | "Edit scene properties" | onClick: {()=>setSelection('scene')} | — |
| 167 | button | [dynamic label] | onClick: {()=>ctx.setMode(mode)} | — |
| 167 | button | Save draft | onClick: {saveDraft} | — |
| 167 | button | "Review and save to a local checkout" | onClick: {openNative} | — |
| 167 | IconButton | "Reset studio layout" | onClick: {resetLayout} | — |
| 167 | IconButton | "Toggle inspector" | onClick: {()=>setInspectorOpen(!inspectorOpen)} | — |
| 168 | IconButton | "Add scene" | onClick: {()=>{let id;update(project=>{id=addScene(project);},'Scene slot enabled');if(id)choose(id);}} | {!ordered.some(row=>row.enabled===false)} |
| 168 | button | [dynamic label] | onClick: {()=>choose(row.id)} | — |
| 168 | IconButton | "Move scene earlier" | onClick: {()=>update(project=>reorderScene(project,scene.id,-1))} | {ordered[0]?.id===scene.id} |
| 168 | IconButton | "Move scene later" | onClick: {()=>update(project=>reorderScene(project,scene.id,1))} | {ordered.at(-1)?.id===scene.id} |
| 170 | button | [dynamic label] | onClick: {togglePlay} | {!ready} |
| 170 | IconButton | "Zoom out" | onClick: {()=>setZoom(z=>clamp(z-.25,.25,3))} | — |
| 170 | IconButton | "Zoom in" | onClick: {()=>setZoom(z=>clamp(z+.25,.25,3))} | — |
| 170 | IconButton | "Fit canvas" | onClick: {fit} | — |
| 170 | IconButton | "Toggle grid" | onClick: {()=>setGrid(!grid)} | — |
| 170 | IconButton | "Snap to one percent" | onClick: {()=>setSnap(!snap)} | — |
| 170 | button | Safe area | onClick: {()=>setSafe(!safe)} | — |
| 170 | button | Mobile | onClick: {()=>setPhone(!phone)} | — |
| 170 | IconButton | "Undo draft change" | onClick: {()=>setH(undo)} | {!h.past.length} |
| 170 | IconButton | "Redo draft change" | onClick: {()=>setH(redo)} | {!h.future.length} |
| 171 | button | Resolve conflict | onClick: {()=>ctx.setDialog('conflict')} | — |
| 173 | IconButton | "Select tool (V)" | onClick: {()=>setTool('select')} | — |
| 173 | IconButton | "Pan tool (H)" | onClick: {()=>setTool('hand')} | — |
| 173 | IconButton | "Select traveller" | onClick: {()=>changeSelection('actor')} | — |
| 173 | IconButton | "Select dialogue" | onClick: {()=>changeSelection('text')} | — |
| 173 | IconButton | "Select background" | onClick: {()=>changeSelection('background')} | — |
| 173 | IconButton | "Select audio cues" | onClick: {()=>changeSelection('audio')} | — |
| 173 | IconButton | "Lock selected object" | onClick: {()=>setLocked(!locked)} | — |
| 181 | button | {id==='actor'?'Traveller on canvas':'Dialogue on canvas'} | onPointerDown: {e=>{e.stopPropagation();changeSelection(id);if(id==='actor'\|\|id==='text')startDrag(e,'move',id);}} | — |
| 182 | button | {'Resize traveller '+corner} | onPointerDown: {e=>startDrag(e,'resize')} | — |
| 187 | button | [dynamic label] | onClick: {()=>{setDevice(device==='mobile'?'desktop':'mobile');fit();}} | — |
| 190 | IconButton | "Rewind scene" | onClick: {()=>seek(0)} | {!ready} |
| 190 | IconButton | {playing?'Pause timeline':'Play timeline'} | onClick: {togglePlay} | {!ready} |
| 190 | button | [dynamic label] | onClick: {()=>changeSelection(track.id)} | — |
| 190 | button | [dynamic label] | onClick: {e=>{e.stopPropagation();changeSelection(track.id);}} | — |
| 190 | button | {audioError\|\|audioStatus} | onClick: {()=>setSelection('audio')} | — |
| 195 | button | {floating?'Dock inspector to workspace':'Float inspector over workspace'} | onClick: {()=>preference('inspectorFloating',!inspectorFloating)} | — |
| 196 | IconButton | "Reset inspector position" | onClick: {()=>movableInspector.reset()} | — |
| 197 | IconButton | "Close scene inspector" | onClick: {()=>setInspectorOpen(false)} | — |

### SceneStudioInspector.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 63 | button | {`Use ${art.label} artwork`} | onClick: {() => patch('art', art.id)} | — |
| 69 | button | "Use sequence staging again; keeps the scene’s stored values" | onClick: {() => patch('ownStaging', false)} | — |
| 82 | button | Reset native placement | onClick: {() => update(project => patchActor(project, scene.id, device, {...getActor({id: scene.id}, device), positionMode: 'auto'}))} | — |
| 85 | button | [dynamic label] | onClick: {() => setDevice?.(id)} | — |
| 87 | button | Copy placement to | onClick: {() => update(project => patchActor(project, scene.id, device === 'mobile' ? 'desktop' : 'mobile', {...actor, positionMode: 'manual'}))} | — |
| 145 | button | Audition native cues | onClick: {() => audioTools.audition()} | — |
| 145 | button | Stop audio | onClick: {() => audioTools.stop()} | — |
| 172 | button | [dynamic label] | onClick: {() => setTab(name)}; onKeyDown: {event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const names = ['Inspector', 'Assets', 'Effects']; | — |
| 199 | button | [dynamic label] | onClick: {() => setSelection?.(key)} | — |
| 202 | button | Edit traveller placement | onClick: {() => {setSelection?.('actor'); setTab('Inspector');}} | — |

### Views.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 19 | button | Review proposed changes | onClick: {()=>{try{const q=JSON.parse(proposal);if(q.id!==card.id\|\|!q.name\|\|!Array.isArray(q.effects))throw new Error('Proposal needs this ID, a name and an effects array');setDialog({kind: | — |
| 20 | button | Inspect | onClick: {()=>choose(q.id)} | — |
| 25 | button | [dynamic label] | onDragStart: {e=>e.dataTransfer.setData('text/plain',q.id)}; onClick: {()=>choose(q.id,'decks')} | — |
| 25 | button | Add | onClick: {()=>add(q.id)} | {p.deck.filter(id=>id===q.id).length>=p.owned[q.id]} |
| 25 | button | [dynamic label] | onClick: {()=>choose(id,'decks')} | — |
| 25 | button | {`Remove ${id} copy ${i+1}`} | onClick: {()=>update(n=>n.deck.splice(i,1),'Sandbox copy removed')} | — |
| 25 | button | Confirm deck | onClick: {()=>{initial.current=clone(p.deck);tell('Sandbox deck confirmed locally');}} | {issues.length>0} |
| 25 | button | Cancel session changes | onClick: {()=>update(n=>n.deck=clone(initial.current),'Deck session restored')} | — |
| 29 | a | Open full window | href: {publicUrl('native/erd-workbench-0.2.4.html')} | — |
| 31 | button | Choose native .erd.json | onClick: {()=>input.current.click()} | — |
| 31 | button | Load mapping example | onClick: {()=>load({format:'erd-workbench',version:3,appVersion:'0.2.4',pages:[{id:'example',name:'Mapping example',nodes:[{id:'diagram-tag',type:'entity',name:'Tag',fields:[{name:'id'},{na | — |
| 31 | button | Apply reviewed tags to draft | onClick: {()=>update(n=>{const all=new Map(n.nodes.map(q=>[q.id,q]));mapped.proposed.forEach(({_row,...q})=>all.set(q.id,q));n.nodes=[...all.values()];n.erdNative={raw:native,mapping,page:p | {!rows.length\|\|mapped.errors.length>0\|\|mapped.changed>0&&!overwrite} |
| 32 | button | [dynamic label] | onClick: {()=>choose(q.id)} | — |
| 33 | button | Inspect | onClick: {()=>choose(q.id)} | — |
| 52 | button | [dynamic label] | onClick: {()=>setPlaying(!playing)} | — |
| 52 | button | Restart | onClick: {()=>{setPlaying(false);setTime(0);}} | — |
| 52 | button | [dynamic label] | onClick: {()=>{setPoseSelected(i);setTime(i*p.pose.duration/p.pose.poses.length);}} | — |
| 52 | button | / + ms / ms | onClick: {()=>setClipId(clip.id)} | — |
| 54 | button | Play in game | onClick: {()=>c.setMode('In game')} | — |
| 58 | button | Undo | onClick: {()=>setH(undo)} | {!h.past.length} |
| 58 | button | Redo | onClick: {()=>setH(redo)} | {!h.future.length} |
| 58 | button | Review reset to source | onClick: {()=>setDialog('reset')} | — |
| 60 | a | [dynamic label] | href: {publicUrl('source/'+f)} | — |
| 61 | a | Open responsive editor preview | href: {publicUrl('responsive-preview.html')} | — |
| 61 | button | Export whole project | onClick: {()=>download('AshenedSpire-editor.json',p)} | — |
| 61 | button | Import / review project | onClick: {()=>setDialog('review')} | — |
| 61 | button | Preview health | onClick: {()=>setDialog('health')} | — |
| 66 | button | Add selected copy | onClick: {()=>update(n=>n.deck.push(card.id),'Sandbox copy added')} | {p.deck.filter(id=>id===card.id).length>=p.owned[card.id]} |
| 66 | button | Import card artwork | onClick: {()=>image.current.click()} | — |
| 66 | button | Remove artwork override | onClick: {()=>update(n=>delete n.styles[card.id].art)} | — |
| 66 | button | Preview & edit in game | onClick: {()=>setMode('In game')} | — |
| 66 | button | Open animation binding | onClick: {()=>c.openWorkspace('poses','Bindings')} | — |
| 66 | button | Inspect tags | onClick: {()=>switchWs('tags')} | — |
| 70 | button | Edit native JSON | onClick: {()=>setMode('JSON')} | — |
| 71 | button | Replace selected pose PNG/WebP | onClick: {()=>poseImage.current.click()} | — |
| 71 | button | Add effect clip | onClick: {()=>{const id='clip.'+(crypto.randomUUID?.()\|\|crypto.getRandomValues(new Uint32Array(2)).join('-'));patchPose(q=>q.clips.push({id,effect:'shieldBash',cue:'contact',offset:0,durati | — |
| 71 | button | Remove clip | onClick: {()=>{patchPose(q=>q.clips=q.clips.filter(a=>a.id!==clipId));setClipId('');}} | — |
| 73 | button | Repositories | onClick: {()=>setMode('Repositories')} | — |
| 73 | button | Files | onClick: {()=>setMode('Files')} | — |
| 73 | button | Builds | onClick: {()=>setMode('Builds')} | — |
| 74 | button | Export whole project | onClick: {()=>download('AshenedSpire-editor.json',p)} | — |
| 74 | button | Import / review | onClick: {()=>c.setDialog('review')} | — |

### WorkbookImport.jsx

| Line | Kind | Label | Handler / target | Disabled condition |
|---|---|---|---|---|
| 66 | button | Close | onClick: {onClose} | — |
| 68 | button | Choose Excel workbook (.xlsx) | onClick: {() => input.current.click()} | {busy} |
| 76 | button | Review table changes | onClick: {prepare} | — |
| 80 | button | Show next 100 changes | onClick: {() => setVisibleChanges(value => value + 100)} | — |
| 81 | button | Apply reviewed table to draft | onClick: {apply} | — |


## Browser evidence and remaining boundaries

Baseline isolated Edge run completed 49 successful checks: 44 workspace/mode entry checks across all nine workspaces plus five representative authoring/interchange checks (card edit/undo, reviewed new card/undo, ERD mapping review/apply/undo, pose clip add/remove, and JSON download). These are entry and representative action checks, not 49 exhaustive action families. There were no page errors; one generic console 404 lacked a captured request URL. Root is separately repairing preview asset copying. No conclusion about that warning is made here.

Fresh CUA Chrome checks confirmed automatic local host connection, Cards native preview, Open animation binding navigation to Poses/Bindings without mutation, Add card to game dialog with honest disabled controls when no repositories exist, and focus restoration on dialog close. A loss of dialog focus after asynchronous loading was reproduced and fixed. CUA later timed out when reacquiring the separate audit tab; no further actions are claimed from those attempts. Parent-agent menu/studio tests are separate evidence.

All 40 top-level JS/JSX/MJS source modules parsed successfully after surgical fixes, including the repaired movable hook. The 29 targeted native-document, local-host-provider, and scene-model tests passed afterward. The final full npm test run passed all 145 tests with zero failures. Host integration tests run serially to avoid Windows fixture contention; the earlier failed runs are superseded by this completed run.

| Acceptance group | Reviewed / exercised | Remaining runtime boundary |
|---|---|---|
| Content | Nine workspace mode entries; representative card creation/edit/undo, pose clip edits, tag mapping; source handlers for deck, source records and scenes | Every repeated record instance and every native embedded game command were not clicked. |
| Presentation | Source inventory covers canvas selection/transforms, fit/zoom/grid/snap/guides, inspector tabs/assets/effects, movable/pinned windows, responsive profiles and layer timeline | Parent handles final rebuilt drag, keyboard, persistence and responsive tests. Native game scenes have fixed supported objects. |
| Settings | Source adapters, accepted native audio choices, duration bounds, settings profile and promotion checks reviewed | Promotion never run against user checkout; fixture coverage only. Native music audition is separate from seeking animation. |
| Source control | Repository registration/selection, single guarded navigation, branches, files, revision checks, jobs and artifacts reviewed; temporary-host tests exercise gates | No repository clone/import, real checkout writes, branch deletion, package install, or build launch performed through audit UI. Empty host cannot demonstrate enabled file/build action flows. |
| Verification | Parser plus native/model/host fixture tests; 49 baseline browser checks; fresh CUA targeted regression checks | Final in-app browser focus, menu/studio movement, persistence and responsive recovery checks passed. |
| Interchange | JSON download and reviewed ERD map application exercised; workbook/native import/export handlers and tests reviewed | Native ERD internal commands and OS file-picker import flows not exhaustively exercised. |
| Delivery | Output uses actual assets/native renderers with restricted host actions separated | No remote publication or public-host writes performed. |

The inventory includes wrapper buttons whose handler is supplied through spread props (SceneStudio IconButton), movable handles whose handlers come from useMovablePanel, and GameSettings form-submit buttons handled by the enclosing form. These are intentionally not treated as inert merely because the AST row has no literal onClick. Native iframes remain separately bounded; their control sets are not counted among these 221 shell declarations. File/Edit/View/Build/Window/Help menu data were also reviewed: 28 fixed menu actions plus generated current-workspace modes and nine workspace choices, including separator-free keyboard traversal, pin/close/reset, and menu positioning.

## Final build browser addendum

Fresh CUA regression checks on the rebuilt 5181 preview confirmed: Open animation binding lands on Poses/Bindings with object ambush and Undo still disabled; Words & sound renders exactly ten native music choices and eight native stinger choices; the legacy inspector now visibly reports 1–180 seconds. These checks navigated only and did not alter the saved authoring draft. Chrome subsequently timed out sending the native-document menu click; a fresh snapshot confirmed that dialog did not open. The failed attempt is not counted as a pass. The parent agent has the working in-app browser and will perform the final native dialog focus check.

Parent-agent CUA evidence reported for this build: menu pointer/key movement, pinning, outside/action-close behavior and reset; App dialog movement and focus trap; scene inspector pointer/key movement, dock/float, position persistence across reload, width resize/reset; viewport bounds at desktop 1440×852, tablet 900×760, and phone 390×844. That run reported no console warnings or errors. These are attributed parent checks rather than additional claims in the 49-check isolated baseline total. Final rebuilt-browser verification confirmed Escape closes About before its pinned Help menu, and a moved File menu remains visibly above an overlapping floating inspector.

### Final native dialog regression

Root verified the fresh build in the in-app browser at http://127.0.0.1:5181/: Checkout opens the native dialog and focus remains on enabled Close after the asynchronous host check. Shift+Tab wraps to the native path field; Tab wraps back to Close. Escape closes the dialog. No checkout was selected or written.

### Final transport and delivery verification

The final production build passed. The full test log is `.workbench/final-test-serial.log` (145 passed, zero failed). The new visible Restart and Stop controls supplement the original 221-declaration audit inventory. Root exercised Restart → Pause → Resume → Pause → Stop in the actual native scene frame: Resume continued from the paused playhead, and Stop returned to time zero, restored Play preview, and reported native audio stopped. PageUp seeking reached one second and displayed the native traveller and artwork. The three transport controls remained within the mobile viewport. No console warnings or errors were recorded in this final browser run. Screenshot: `qa/menu-layout/final.png`. Viewport overrides were reset afterward. This is a local preview; no new public build was published in this task.

## Isolated scene merge validation

The scene feature was rebased onto the current dev delivery in a D: worktree, preserving its native renderer snapshot, account pause/security boundaries, and dependency updates. Concurrent card/workbook/sprite work remains separate.

All 123 tests in the isolated npm test command passed, with zero failures. After the master inspector review fixes, all 29 studio tests and the 4 Sites packaging tests passed again; quick review parsed 112 files. Production and nested consolidated builds passed using /AshenedSpire-Editor/test/scene-verify/.

CUA exercised shared caption height across two scenes, a sparse local height override, native In game scene advance, desktop/mobile sizing, Undo recovery, all four master component pages, Compact native controls, native transform limits and integer rounding. Per-scene duration, delay and lock controls are disabled in Master mode. Review found and fixed native choice/range/checkbox mismatches. The single-file browser check exposed parent-owned Blob URLs in the new studio; it now uses the existing data-URL frame resolver. Final consolidated artwork/playback evidence is recorded after that fix.

Fixed caption height is an editor preview adapter retained in exports. The unmodified game renderer does not consume those extension fields in ordinary checkout gameplay.

Final single-file CUA verification confirmed decoded native artwork (640 px source), master caption geometry at approximately 24vh, Restart reaching the native scene end, Stop returning to zero, and In game playback retaining approximately 24vh. No console warnings/errors were captured. Screenshot: qa/menu-layout/master-default.png in the main authoring checkout. These checks did not write a game checkout.

## October 2, 2026 audit

Scope: latest `dev` (e30d752) on the Vite dev host (`npm run dev -- --port 5181`, automatic loopback session, accounts paused). Driven with headless Chromium (Playwright) at 1440×900, 900×760 and 390×844, plus 800/1000/1100 toolbar checks. Scripts lived outside the repository. Screenshots: `docs/screenshots/audit-20261002/` (desktop and phone per workspace, Scenes Master default and All scenes timeline, Battlefield after edit, Project Builds).

Evidence labels: **Browser-exercised** = clicked/keyed in this run with the observed result; **Source-reviewed** = handler read, not clicked; **Host-restricted** = needs an imported local checkout, an OS file picker or a real build, so it was not executed (the host reported "Host connected" with no repositories).

### Method and global results

- Every workspace and every canvas mode (44 entries, including In game) at three viewports: no horizontal page overflow, no off-screen controls (after fixes), no clipped workspace titles, no overlapping toolbar controls.
- Navigation alone (workspace, mode, inspector mode, rail scene, Master default, timeline scope, Battlefield device/encounter/class/guides/grid, menu open/close, Find, dialogs) never changed the stored authoring draft and never enabled Undo.
- Top bar: every File / Edit / View / Build / Window / Help item clicked in all nine workspaces and Project Files (≈330 item activations). Each produced a dialog, download, file chooser, toast, mode/workspace change or focus move; Undo/Redo correctly disabled with empty history; draft commands correctly disabled in repository modes.
- Keyboard: ArrowDown/Up open, Home/End, letter search, ArrowLeft/Right between menus with wrap, Escape returns focus to the trigger, Tab closes an unpinned menu. Pin survives outside clicks and action selection; drag, reset and close work; Escape closes a dialog before its pinned menu. Ctrl+K opens Find with the search field focused.
- Dialogs (Find, Review changes, Review reset, Preview health, About, Native checkout document, New card): initial focus inside, Tab and Shift+Tab stay inside (App dialogs and native checkout), Escape closes, movable dialogs drag. The New card native `<dialog>` uses the browser's modal inertness rather than the App focus trap.
- Generic toolbar/inspector sweep: every visible enabled button per workspace and mode (two samples of repeated record buttons) was clicked with a DOM-mutation, toast, download, dialog, draft and Undo check. No inert control was found other than re-selecting the already active mode/tab.
- Console: no page errors and no console errors. Expected noise only: the aborted duplicate `/api/auth/session` and `/api/workbench/status` requests from React StrictMode / navigation, and Chromium's sandbox warning for the native ERD iframe (`allow-scripts allow-same-origin`, required for its own storage).

### Content

| Area | Browser-exercised | Source-reviewed / host-restricted |
|---|---|---|
| Cards | + New card review dialog; previous/next card; Library launcher; In game switch and View → Visual / In game kept in sync with the footer; zoom, Fit, Upgraded, fullscreen; inspector Selection / Table (Inspect selects record) / Form / Layout (layer up/down, All/None) / JSON (reset buffer) / Prompt (review proposal dialog); ratio and rules-font steppers with Undo; Open animation bindings → Poses / Bindings; Inspect tags → Tags | Import card artwork and per-part background import (file picker); Add card to game (host-restricted). |
| Decks | Collection / In game / Validation; card selection, Add/Remove limits, Cancel session changes | Drag-and-drop to deck source-reviewed. |
| Tags / ERD | In game, Tree, ERD 0.2.4, Import, CSV modes; tree/table selection; Choose native .erd.json opens file chooser | ERD internal commands (native iframe); import mapping/apply needs a file. |

### Presentation

| Area | Browser-exercised | Source-reviewed / host-restricted |
|---|---|---|
| Scenes studio | Restart → Play → Pause → Resume → Stop (returns to 0); Play all advanced to scene 2 with Pause all / Resume all / Stop; Timeline ↔ All scenes scope (00:25 total); Master default component list; rail selection; Add scene, Move scene later (undoable); zoom, Fit, grid, snap, safe area, mobile, tool strip, object selection, lock; inspector float, close, Toggle inspector, Reset studio layout; Window → Focus editor / Library / Inspector route into the studio | Canvas drag/resize transforms and timeline edge drags source-reviewed (previous audit exercised them). Native audio output not audible in headless runs. |
| Battlefield | Figure select; pointer drag of a figure (one undoable column-offset edit, Undo restores the exact draft); arrow-key burst nudging; + sprite-scale key; top-handle scale drag; Battlefield / hand row drag (labelled preview proposal); all sprite/row scale steppers; device/encounter/class/guides/grid view choices (no draft change); Layout / In game / Sizing diagnostics / Compare | Checkout promotion of presentation settings is host-restricted. |
| UI settings | Config band steppers, In game, Compare, New wireframe review | Native UI document save host-restricted. |
| Poses & effects | Stage play/restart, pose thumbnails, sequence duration steppers, Add effect clip, In game, Bindings | Replace pose PNG/WebP (file picker). |
| Movable layout | Menu drag/pin/reset/close; dialog drag; Window → Reset window positions and Restore default layout | Inspector width resize source-reviewed. |

### Settings

Project → Game settings: Export native settings JSON downloads; Add override uses required-field validation; Overrides tab responds. Native settings promotion to a checkout is host-restricted (no imported checkout).

### Source control

Repositories / Files / Builds render with "Host connected", no imported repositories, and draft commands disabled in these modes. Import local repository, branch create/switch/delete, file save, install/build/test jobs were not executed (host-restricted; covered by existing fixture tests).

### Verification

Build → Validate authoring draft passes; Preview / Editor health dialogs report no captured runtime errors. `npm run review:quick`, `npm run build` and `npm test` pass after the fixes below.

### Interchange

Export current document, CSV, XLSX and whole-project exports each produced a download in every workspace; Import authoring package and Ctrl+O open the file chooser. Package import content and XLSX import review need user files (not exercised).

### Delivery

No push, no Pages publication and no checkout writes were performed. The dev server was stopped after the audit.

### Fixes made

| Finding | Fix |
|---|---|
| Scenes header: stale absolute menu positioning in `scene-studio.css` overrode the flowing shell header. On phones the File menu sat 5 px off-screen and the menu row overlapped the studio document bar; the fixed 39 px / 66 px header rows ignored the wrapped header. | Removed the obsolete absolute/margin rules and fixed header rows so the shared shell layout applies; phone padding matches other workspaces; floating inspector top offset follows the real header height. |
| Battlefield keyboard nudging lost focus after each committed key burst (the native frame remounts the overlay), so later arrow / + / − presses did nothing. | Focus returns to the same figure once the overlay re-measures. |
| Stepper buttons stored float noise (e.g. Player sprite scale `0.9500000000000001`, shown in the toast and saved in the draft). | `NumberControl` rounds stepped values to the step's precision. |
| No-op edits (e.g. "Reset to inherited value" when already inherited, reset-to-source when unchanged) pushed identical Undo entries, enabling Undo without a change. | `update` skips committing an unchanged project; Reset local draft skips an identical baseline. |
| Find anything did not return focus to its trigger on close (React `autoFocus` ran before the dialog captured the previous focus). | Removed the redundant `autoFocus`; the dialog effect already focuses the search field. |
| Tablet (781–1050 px) toolbars hid Undo/Redo entirely (the command menu only appears ≤780 px) and squeezed titles into up to five lines. | History icons stay visible; titles take their own row with library, mode and history controls together on the next row. |
| Phone toolbars wrapped the workspace command select onto its own row, clipped to "Battlefie…". | Title takes its own row; library, mode and workspace selects share one row and the command select can widen to 150 px. |

### Remaining boundaries

- Host-restricted actions (checkout import, branch operations, file saves, builds, native settings promotion, Add card to game) and OS file-picker imports were not executed in the browser.
- The first page load in React StrictMode writes the (unchanged) recovered draft back to local storage; this is not an authoring change.
- Keys pressed during the ~1 s native frame reload after a Battlefield edit are not applied; focus returns once the figure is measured again.
