#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const OUTPUT_PATH = 'ai-review-local.md';

function env( name, fallback = '' ) {
	const value = process.env[ name ];
	return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asBool( value, fallback = false ) {
	if ( ! value ) {
		return fallback;
	}
	return [ '1', 'true', 'yes', 'on' ].includes(
		String( value ).toLowerCase()
	);
}

function git( args ) {
	return execFileSync( 'git', args, { encoding: 'utf8' } ).trimEnd();
}

function splitArgs( input ) {
	return input
		.split( /\s+/ )
		.map( ( entry ) => entry.trim() )
		.filter( Boolean );
}

function buildPrompt( { diff, standards, baseRef } ) {
	return [
		'Du prüfst lokale Git-Änderungen für ein WordPress-Gutenberg-Blocks-Plugin.',
		'',
		`Basisreferenz: ${ baseRef }`,
		'',
		'Bewertungsdimensionen:',
		'1) Nutzen und Ausrichtung auf den Geschäftswert',
		'2) Code-Qualität und Wartbarkeit',
		'3) Einhaltung der AGENTS.md-Standards für Code und Stil',
		'4) Potenzielle Fehler und Verhaltensregressionen',
		'5) Sicherheits- und Datenschutzrisiken',
		'',
		'Gib Markdown mit diesen Abschnitten in dieser Reihenfolge zurück:',
		'## Urteil',
		'## Zusammenfassung',
		'## Blocker',
		'## Größere Findings',
		'## Kleinere Findings',
		'## Empfohlene nächste Schritte',
		'',
		'Alle Texte in der Antwort müssen auf Deutsch sein.',
		'',
		'Projektstandards (AGENTS.md):',
		standards,
		'',
		'Git-Diff zur Bewertung:',
		diff,
	].join( '\n' );
}

function runClaudeCli( prompt ) {
	const command = env( 'CLAUDE_CLI_COMMAND', 'claude' );
	const args = splitArgs( env( 'CLAUDE_CLI_ARGS', '' ) );
	return execFileSync( command, args, {
		encoding: 'utf8',
		input: prompt,
	} ).trim();
}

function main() {
	const baseRef =
		process.argv[ 2 ] || env( 'LOCAL_AI_REVIEW_BASE', 'origin/main' );

	try {
		const diff = git( [ 'diff', '--no-color', `${ baseRef }...HEAD` ] );
		if ( ! diff.trim() ) {
			console.log( `No local diff found against ${ baseRef }.` );
			return;
		}

		const standards = readFileSync( 'AGENTS.md', 'utf8' );
		const prompt = buildPrompt( { diff, standards, baseRef } );
		const review = runClaudeCli( prompt );
		const output = [
			'<!-- rocket-blocks-local-ai-review -->',
			`# Lokale Claude-Bewertung (${ baseRef }...HEAD)`,
			'',
			review || 'Claude CLI hat keine Ausgabe zurückgegeben.',
			'',
			'_Erstellt von bin/ci/claude-local-review.mjs._',
		].join( '\n' );

		writeFileSync( OUTPUT_PATH, `${ output }\n`, 'utf8' );
		console.log( `Local review written to ${ OUTPUT_PATH }` );
	} catch ( error ) {
		console.warn( `Local Claude review failed: ${ error.message }` );
		if ( asBool( env( 'LOCAL_AI_REVIEW_STRICT', 'false' ), false ) ) {
			process.exit( 1 );
		}
	}
}

main();
