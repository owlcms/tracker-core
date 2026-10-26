#!/usr/bin/env node

import assert from 'node:assert/strict';

import { CompetitionHub } from '../src/competition-hub.js';

console.log('✓ Testing hub resource refresh...\n');

function hubWithResponder(respond) {
	const hub = new CompetitionHub();
	const requests = [];
	hub.setRequestResourcesCallback((resources, options) => {
		requests.push({ resources, options });
		setTimeout(() => respond(hub, resources), 10);
		return true;
	});
	return { hub, requests };
}

function markLoaded(hub) {
	hub.databaseState = { athletes: [{ key: 1 }] };
	hub.translationsReady = true;
	hub.flagsLoaded = true;
	hub.logosLoaded = true;
}

const EVENTS = {
	database: 'database:received',
	translations_zip: 'translations_loaded',
	flags_zip: 'flags_loaded',
	logos_zip: 'logos_loaded',
	pictures_zip: 'pictures_loaded',
	gamx_zip: 'gamx_loaded'
};

// Waits for each refreshed resource and sends a single refresh:true request
{
	const { hub, requests } = hubWithResponder((h, resources) => {
		for (const r of resources) h.emit(EVENTS[r]);
	});
	markLoaded(hub);
	const result = await hub.refreshResources(['database', 'logos_zip', 'flags_zip'], { timeoutMs: 2000 });
	assert.equal(result.sent, true);
	assert.deepEqual(result.timedOut, []);
	assert.deepEqual([...result.received].sort(), ['database', 'flags_zip', 'logos_zip']);
	assert.equal(requests.length, 1, 'a single request should be sent');
	assert.equal(requests[0].options.refresh, true, 'request must ask OWLCMS to refresh');
	assert.equal(requests[0].options.reason, 'resource_refresh');
}

// Archives not yet loaded are requested but not waited for (OWLCMS skips empty archives)
{
	const { hub, requests } = hubWithResponder((h) => h.emit(EVENTS.database));
	markLoaded(hub);
	hub.logosLoaded = false;
	const started = Date.now();
	const result = await hub.refreshResources(['database', 'logos_zip'], { timeoutMs: 2000 });
	assert.deepEqual(requests[0].resources, ['database', 'logos_zip']);
	assert.deepEqual(result.timedOut, []);
	assert.ok(Date.now() - started < 1000, 'should not wait for an archive that was never loaded');
}

// The database is waited for even when none is loaded yet
{
	const { hub } = hubWithResponder((h) => h.emit(EVENTS.database));
	const result = await hub.refreshResources(['database'], { timeoutMs: 2000 });
	assert.deepEqual(result.received, ['database']);
}

// Times out on a loaded resource that is not resent
{
	const { hub } = hubWithResponder((h) => h.emit(EVENTS.database));
	markLoaded(hub);
	const result = await hub.refreshResources(['database', 'flags_zip'], { timeoutMs: 300 });
	assert.deepEqual(result.received, ['database']);
	assert.deepEqual(result.timedOut, ['flags_zip']);
	assert.equal(hub.listenerCount('flags_loaded'), 0, 'listeners must be removed after timeout');
}

// Full refresh asks only for optional archives the tracker already has
{
	const { hub, requests } = hubWithResponder((h, resources) => {
		for (const r of resources) h.emit(EVENTS[r]);
	});
	markLoaded(hub);
	hub.gamxLoaded = false;
	hub.picturesLoaded = false;
	const result = await hub.requestFullRefresh({ timeoutMs: 2000 });
	assert.deepEqual(requests[0].resources, ['database', 'translations_zip', 'flags_zip', 'logos_zip']);
	assert.deepEqual(result.timedOut, []);
}

// No connection: not sent, returns after the timeout
{
	const hub = new CompetitionHub();
	hub.setRequestResourcesCallback(() => false);
	const result = await hub.refreshResources(['database'], { timeoutMs: 600 });
	assert.equal(result.sent, false);
}

// After a reconnect, local asset directories are purged, so every archive must be re-requested
{
	const hub = new CompetitionHub();
	markLoaded(hub);
	hub.picturesLoaded = true;
	hub.gamxLoaded = true;
	hub.refresh();
	assert.deepEqual(
		hub.checkPluginPreconditions(['flags_zip', 'logos_zip', 'pictures_zip', 'gamx_zip']),
		['flags_zip', 'logos_zip', 'pictures_zip', 'gamx_zip'],
		'refresh() must reset every archive so it is requested again'
	);
}

console.log('✓ Hub resource refresh waits for fresh resources and requests refresh:true\n');
