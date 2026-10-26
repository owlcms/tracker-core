#!/usr/bin/env node

import assert from 'node:assert/strict';

import { CompetitionHub } from '../src/competition-hub.js';

console.log('✓ Testing inbound format compatibility...\n');

// Translations: OWLCMS sends underscore locale keys (fr_CA); hyphenated requests also work
{
	const hub = new CompetitionHub();
	hub.setTranslations('en', { Start: 'Start', Stop: 'Stop' });
	hub.setTranslations('fr', { Start: 'Commencer', Stop: 'Arrêter' });
	hub.setTranslations('fr_CA', { Start: 'Démarrer' });

	assert.equal(hub.getTranslations({ locale: 'fr_CA' }).Start, 'Démarrer', 'exact underscore match');
	assert.equal(hub.getTranslations({ locale: 'fr_CA' }).Stop, 'Arrêter', 'regional map merged with its base language');
	assert.equal(hub.getTranslations({ locale: 'fr-CA' }).Start, 'Démarrer', 'hyphenated request finds the underscore key');
	assert.equal(hub.getTranslations({ locale: 'fr_BE' }).Start, 'Commencer', 'unknown region falls back to base language');
	assert.equal(hub.getTranslations({ locale: 'fr-BE' }).Start, 'Commencer', 'hyphenated unknown region falls back to base language');
	assert.equal(hub.getTranslations({ locale: 'de' }).Start, 'Start', 'unknown language falls back to English');

	// A base locale received after its regional variant is merged into it
	const late = new CompetitionHub();
	late.setTranslations('es_419', { Start: 'Iniciar' });
	late.setTranslations('es', { Start: 'Comenzar', Stop: 'Detener' });
	assert.equal(late.getTranslations({ locale: 'es_419' }).Start, 'Iniciar', 'regional value kept');
	assert.equal(late.getTranslations({ locale: 'es_419' }).Stop, 'Detener', 'base keys added to regional variant');
}

// Decision records: OWLCMS 69 sends an object; older OWLCMS sent a JSON string
{
	const recordsTable = {
		recordNames: ['IWF'],
		recordCategories: ['SR 89'],
		recordTable: [{ cat: 'SR 89', recordClass: 'recordBox', records: [{ SNATCH: 175, CLEANJERK: 216, TOTAL: 387 }] }],
		nbRecords: 2
	};
	const decision = (records) => ({
		fop: 'A',
		decisionEventType: 'FULL_DECISION',
		d1: 'true', d2: 'true', d3: 'true',
		decisionsVisible: 'true',
		down: 'false',
		recordKind: 'none',
		records
	});

	const fromObject = new CompetitionHub();
	fromObject.handleOwlcmsMessage(decision(recordsTable), 'decision');
	assert.deepEqual(fromObject.fopUpdates.A.records, recordsTable, 'object records are kept as is');

	const fromString = new CompetitionHub();
	fromString.handleOwlcmsMessage(decision(JSON.stringify(recordsTable)), 'decision');
	assert.deepEqual(fromString.fopUpdates.A.records, recordsTable, 'string records (legacy OWLCMS) are parsed');

	const fromNullString = new CompetitionHub();
	fromNullString.handleOwlcmsMessage(decision('null'), 'decision');
	assert.equal(fromNullString.fopUpdates.A.records, null, 'legacy "null" string means no records');
}

console.log('✓ Inbound format compatibility tests passed\n');
