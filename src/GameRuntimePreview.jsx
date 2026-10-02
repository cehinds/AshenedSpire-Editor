import React, { useEffect, useMemo, useState } from 'react';
import { NativePreviewFrame } from './NativePreviewFrame.jsx';
import { previewContentBundle } from './game-card-preview.mjs';
import {applyCardPresentation} from './card-presentation.mjs';
import {applyCardLayout} from './card-layout.mjs';
import { assignments } from './data.js';
import { combatPreviewSnapshot } from './game-runtime-preview.mjs';
import { useBattlefieldView } from './battlefield-view.js';

// Runs inside the native frame. Every action is dispatched by the real game.
function bootGame(N, host, emit, projectContent,applyPresentation,applyLayout) {
  let layoutObserver;
  return function update({ project: p, workspace, testClass, view = {} }) {
    const settings = Object.fromEntries(Object.entries(p.gameSettings?.overrides || {}).map(([key, value]) => [key.replace(/^settings\./, ''), value]));
    let bundle = N.configuredContentBundle(projectContent(N.contentBundle, p), settings);
    // balance.ui.combatantStage has no settings row; the draft patches the bundle before registries freeze it.
    const stageDefaults = { ...bundle.balance.ui.combatantStage };
    if (p.lab?.stage && Object.keys(p.lab.stage).length) bundle = { ...bundle, balance: { ...bundle.balance, ui: { ...bundle.balance.ui, combatantStage: { ...stageDefaults, ...p.lab.stage } } } };
    const registries = N.createRegistries(bundle);
    const scenario = p.scenario;
    const classId = workspace === 'poses' ? (p.pose?.actor || testClass || 'rogue') : (testClass || 'rogue');
    const seed = [...String(scenario.seed)].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
    const run = N.createRunState({ registries, classId, seed });
    // Native main owns these session fields outside createRunState; combat's
    // post-dispatch renderer records damage in the same ledger.
    run.stats = { fightsWon: 0, damageDealt: 0, damageTaken: 0 };
    run.custom = { ascension: 0, mods: {}, deckMode: 'standard' };
    run.path = [];
    run.seenEvents = [];
    run.lastEncounters = [];
    run.seedString = String(scenario.seed);
    run.customization = { name: 'Preview traveller', spriteStyle: 'painted' };
    run.hp = Math.max(1, Number(scenario.playerHp) || run.hp);
    run.maxHp = Math.max(run.maxHp, run.hp);
    const deck = [...p.deck];
    if (!deck.includes(scenario.cardId)) deck.unshift(scenario.cardId);
    run.deck = N.createDeck(deck);
    document.documentElement.dataset.spriteStyle = 'painted';
    document.documentElement.dataset.handLayout = 'row';
    N.applyWireframeChoices(settings);
    // Native main publishes resolved formation settings here; the battlefield stage reads them on every fit.
    document.documentElement.dataset.formationSettings = JSON.stringify(N.presentationConfig(view.grid ? { ...settings, 'gameConfig.presentation.showFormationGrid': true } : settings));
    if (N.cardShapeCssProperties) for (const [key, value] of Object.entries(N.cardShapeCssProperties())) document.documentElement.style.setProperty(key, value);
    if (N.cardLevelCssProperties) for (const [key, value] of Object.entries(N.cardLevelCssProperties())) document.documentElement.style.setProperty(key, value);
    const encounters = registries.encounters.all();
    const encounter = encounters.find(item => item.id === view.encounter);
    const firstEnemy = registries.enemies.all().find(enemy => !enemy.boss) || registries.enemies.all()[0];
    const enemyIds = encounter?.enemies?.length ? [...encounter.enemies] : [firstEnemy.id];
    const combat = N.createCombat({
      registries, rng: N.createRng(seed),
      player: { ...run, classId, relicIds: run.relics },
      enemyIds,
      ruleset: scenario.ruleset === 'foundations' ? N.combatRules : null,
      ratingsRules: registries.balance.combatRatings || null,
      handRules: N.resolveHandRules(settings, bundle.attributes),
      playerStatuses: N.runMods(registries, run.loadout, classId).startStatuses,
    });
    for (const enemy of combat.enemies) { enemy.maxHp = Math.max(1, Number(scenario.enemyHp) || enemy.maxHp); enemy.hp = enemy.maxHp; }
    if (scenario.prepared) combat.player.statuses.prepared = { stacks: 1, duration: 1 };
    else delete combat.player.statuses.prepared;
    const meta = { settings: { ...settings, seenTutorial: true, reducedMotion: false } };
    const notice = text => emit({ type: 'notice', message: text });
    try { N.initInput({ getSettings: () => meta.settings }); }
    catch (error) { if (error.name !== 'SecurityError') throw error; }
    // Preview-only proposal over the vendored fixed combat rows (see battlefield-lab NATIVE_ROWS).
    let rowStyle = document.getElementById('editor-battlefield-rows');
    if (p.lab?.rows) {
      rowStyle ??= document.head.appendChild(Object.assign(document.createElement('style'), { id: 'editor-battlefield-rows' }));
      rowStyle.textContent = `:root .combat[data-layout='formation']{grid-template-rows:${p.lab.rows.hud}% ${p.lab.rows.field}% ${p.lab.rows.hand}% !important}`;
    } else rowStyle?.remove();
    host.style.cssText = view.fill ? 'height:100vh;min-height:0;width:100%;overflow:hidden' : 'height:100%;min-height:650px;width:100%;overflow:hidden';
    N.mountCombat(host, {
      registries, run, combat, meta, showTutorial: false,
      readSettings: () => meta.settings,
      onEnd: result => notice(result === 'victory' ? 'Victory. Restart to replay this draft.' : 'Defeat. Restart to replay this draft.'),
      onSettings: () => notice('Change settings in the editor inspector; the test restarts with your draft.'),
      onSettingsChange: changes => Object.assign(meta.settings, changes),
      onMenu: () => notice('This is an isolated test encounter. Use Restart above to reset it.'),
      onSave: () => notice('Preview encounters do not write game saves.'),
      onLoad: () => notice('Preview encounters do not load game saves.'),
      onQuit: () => notice('Use Restart above to reset the encounter.'),
      onQuitWithoutSave: () => notice('Use Restart above to reset the encounter.'),
    });
    layoutObserver?.disconnect();
    const styled=new WeakSet();
    const decorate=()=>{for(const face of host.querySelectorAll('.card[data-card-id]')){if(styled.has(face))continue;styled.add(face);const sidecar=p.styles?.[face.dataset.cardId];if(sidecar)applyPresentation(face,sidecar,applyLayout);}};
    decorate();layoutObserver=new MutationObserver(decorate);layoutObserver.observe(host,{childList:true,subtree:true});
    if (workspace === 'poses' && p.pose) {
      const controls = document.createElement('div');
      controls.style.cssText = 'display:flex;gap:10px;align-items:center;padding:8px;background:#18140f';
      const play = document.createElement('button');
      play.textContent = 'Play authored pose in game';
      controls.append(play);
      host.before(controls);
      let stop;
      play.onclick = () => {
        stop?.();
        const layer = host.querySelector('.fx-layer');
        const actor = host.querySelector('.player-zone .sprite');
        if (!layer || !actor) { notice('The native actor stage is not ready.'); return; }
        const card = registries.cards.get(scenario.cardId);
        const from = N.anchorLocalBox(layer, actor);
        const targets = [...host.querySelectorAll('.enemy-row .sprite')].map(target => N.anchorLocalBox(layer, target));
        stop = N.playPresentationSequence(layer, from, { provider: 'ashenspire', kind: 'card', objectId: card.id, event: 'actionResolved', tags: card.tags || [], energySpent: card.cost || 0, manaSpent: card.manaCost || 0, staminaSpent: card.staminaCost || 0 }, { targets, duration: p.pose.duration, project: p.pose, onStop: () => notice('Authored pose playback finished.') });
        notice(stop ? 'Playing your authored pose through the native presentation renderer.' : 'No matching enabled binding, invalid pose data, or reduced motion prevented playback. Review Bindings for the scenario card.');
      };
    }
    if (workspace === 'battlefield') {
      emit({ type: 'battlefield-catalog', stageDefaults, encounter: encounter?.id || null, encounters: encounters.map(item => ({ id: item.id, pool: item.pool, enemies: (item.enemies || []).map(id => registries.enemies.get(id)?.name || id) })) });
      const box = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; };
      const enemyName = eid => { const enemy = combat.enemies.find(item => item.id === eid); return enemy?.name || registries.enemies.get(enemy?.enemyId || enemy?.defId)?.name || eid; };
      let measureTimer;
      const measure = () => {
        const field = host.querySelector('.field');
        if (!field) return;
        const region = selector => { const el = host.querySelector(selector); return el ? box(el) : null; };
        const combatants = [...host.querySelectorAll('.combatant[data-ui-component="combatant-frame"]')].map(frame => {
          const sprite = frame.querySelector(':scope .sprite');
          if (!sprite) return null;
          const art = sprite.querySelector('.pose-stage, img, svg') || sprite.firstElementChild || sprite;
          const role = frame.classList.contains('player') ? 'player' : 'enemy';
          // Native fitting publishes alpha-trimmed visible height; feet stay on the art box bottom.
          const image = box(art), visible = Number(frame.dataset.spriteVisibleHeight);
          const height = Number.isFinite(visible) && visible > 0 ? Math.min(image.height, visible) : image.height;
          const number = key => Number.isFinite(Number(frame.dataset[key])) ? Number(frame.dataset[key]) : null;
          return { eid: frame.dataset.eid, role, name: role === 'player' ? classId[0].toUpperCase() + classId.slice(1) : enemyName(frame.dataset.eid), stature: frame.dataset.stature || 'normal', formationRow: frame.dataset.formationRow || '', cell: frame.dataset.formationCell || '', fitScale: number('baseSpriteScale'), presentationScale: number('presentationScale'), combatantScale: number('combatantScale'), groundY: number('groundY'), zoom: Number(getComputedStyle(sprite).zoom) || 1, frame: box(frame), sprite: box(sprite), image, art: { ...image, y: image.y + image.height - height, height } };
        }).filter(Boolean);
        emit({ type: 'battlefield-metrics', viewport: { width: innerWidth, height: innerHeight }, regions: { hud: region('.combat > .topbar'), field: box(field), hand: region('.hand-overlay'), footer: region('.combat-action-row') }, combatants });
      };
      const schedule = () => { clearTimeout(measureTimer); measureTimer = setTimeout(measure, 120); };
      new ResizeObserver(schedule).observe(host);
      new MutationObserver(schedule).observe(host, { subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
      for (const delay of [400, 1200, 2500]) setTimeout(measure, delay);
    }
    // Expose only diagnostics inside the isolated frame for browser verification.
    window.__nativePreview = { run, combat, registries, workspace };
    emit({ type: 'notice', message: 'Native encounter ready. Select a card, then its target; use End Turn to advance.' });
  };
}

export const runtimeBoot = `(function(N, host, emit) { return (${bootGame.toString()})(N, host, emit, ${previewContentBundle.toString()},${applyCardPresentation.toString()},${applyCardLayout.toString()}); })`;

export function GameRuntimePreview({ ctx }) {
  const { p, ws } = ctx;
  const [restart, setRestart] = useState(0);
  const [testClass, setTestClass] = useState('rogue');
  const [message, setMessage] = useState('Loading native encounter…');
  const { view: battlefield } = useBattlefieldView();
  const encounter = ws === 'battlefield' ? battlefield.encounter : undefined;
  const draft = useMemo(() => combatPreviewSnapshot(p, ws, testClass, assignments, encounter ? { encounter } : undefined), [encounter, p.cards, p.nodes, p.tagging, p.styles, p.deck, p.scenario, p.ui, p.gameSettings, p.pose, p.lab, ws, testClass]);
  const [snapshot, setSnapshot] = useState(draft);
  useEffect(() => { const timer = setTimeout(() => setSnapshot(draft), 200); return () => clearTimeout(timer); }, [draft]);
  const initialGlobals = useMemo(() => ({ __ASHEN_PREVIEW_UI__: snapshot.project.ui }), [snapshot.project.ui]);
  // Native combat installs document listeners: a fresh document is its cleanup boundary.
  const key = JSON.stringify(snapshot) + restart;
  return <section className="game-runtime-preview">
    <div className="toolbar"><strong>Playable game preview</strong><button onClick={() => { setMessage('Restarting native encounter…'); setRestart(value => value + 1); }}>Restart encounter</button><label>Class <select value={testClass} onChange={event => setTestClass(event.target.value)}>{['rogue', 'reaver', 'herald', 'starseer'].map(id => <option key={id}>{id}</option>)}</select></label></div>
    <p className="note">Uses your card definitions, sandbox deck, scenario seed and HP, native ruleset, UI configuration, and supported game settings. Editing these restarts the test with the latest draft.</p>
    {(ws === 'battlefield' || ws === 'poses') && <p className="note">{ws === 'battlefield' ? 'Uses the Battlefield encounter, formation sizing, presentation settings and stage tokens from your draft. Use Layout to edit them against this renderer.' : 'Play authored pose applies the current pose clips and bindings to the native actor and effect renderer. Binding matches use the selected scenario card; preview playback does not deal damage.'}</p>}
    <NativePreviewFrame key={key} title="Playable AshenSpire game preview" boot={runtimeBoot} initialGlobals={initialGlobals} snapshot={snapshot} height={720} onStatus={status => { if (status.type === 'notice' || status.type === 'error') setMessage(status.message); }} />
    <p role="status">{message}</p>
  </section>;
}
