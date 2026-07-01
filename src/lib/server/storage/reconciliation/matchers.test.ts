import { describe, it, expect } from 'vitest';
import {
	heightToResolution,
	extractResolution,
	extractVideoCodec,
	extractHdrFormat,
	extractAudioCodec,
	extractContainer
} from './matchers.js';

describe('heightToResolution', () => {
	it('returns "4K" for 2160', () => {
		expect(heightToResolution(2160)).toBe('4K');
	});
	it('returns "4K" for heights above 2160', () => {
		expect(heightToResolution(3000)).toBe('4K');
	});
	it('returns "1080p" for 1080', () => {
		expect(heightToResolution(1080)).toBe('1080p');
	});
	it('returns "720p" for 720', () => {
		expect(heightToResolution(720)).toBe('720p');
	});
	it('returns "480p" for 480', () => {
		expect(heightToResolution(480)).toBe('480p');
	});
	it('returns "SD" for smaller heights', () => {
		expect(heightToResolution(360)).toBe('SD');
	});
	it('returns null for null/undefined', () => {
		expect(heightToResolution(null)).toBeNull();
		expect(heightToResolution(undefined)).toBeNull();
	});
});

describe('extractResolution', () => {
	it('prefers quality.resolution when present', () => {
		expect(extractResolution({ resolution: '720p' }, { height: 2160 })).toBe('720p');
	});
	it('falls back to heightToResolution when quality.resolution missing', () => {
		expect(extractResolution({}, { height: 1080 })).toBe('1080p');
	});
	it('returns null when both missing', () => {
		expect(extractResolution(null, null)).toBeNull();
	});
});

describe('extractVideoCodec', () => {
	it('prefers quality.codec uppercased', () => {
		expect(extractVideoCodec({ codec: 'h264' }, null)).toBe('H264');
	});
	it('falls back to mediaInfo.videoCodec uppercased', () => {
		expect(extractVideoCodec({}, { videoCodec: 'hevc' })).toBe('HEVC');
	});
	it('returns null when both missing', () => {
		expect(extractVideoCodec(null, null)).toBeNull();
	});
});

describe('extractHdrFormat', () => {
	it('prefers quality.hdr', () => {
		expect(extractHdrFormat({ hdr: 'HDR10' }, { videoHdrFormat: 'dolbyVision' })).toBe('HDR10');
	});
	it('falls back to mediaInfo.videoHdrFormat', () => {
		expect(extractHdrFormat({}, { videoHdrFormat: 'HDR10Plus' })).toBe('HDR10Plus');
	});
	it('returns null when both missing', () => {
		expect(extractHdrFormat(null, null)).toBeNull();
	});
});

describe('extractAudioCodec', () => {
	it('returns mediaInfo.audioCodec uppercased', () => {
		expect(extractAudioCodec({ audioCodec: 'ac3' })).toBe('AC3');
	});
	it('returns null when missing', () => {
		expect(extractAudioCodec(null)).toBeNull();
	});
});

describe('extractContainer', () => {
	it('returns mediaInfo.containerFormat uppercased', () => {
		expect(extractContainer({ containerFormat: 'mkv' })).toBe('MKV');
	});
	it('returns null when missing', () => {
		expect(extractContainer(null)).toBeNull();
	});
});
