/**
 * WebSocket Server Integration
 * 
 * Provides two modes:
 * 1. Standalone: createWebSocketServer(options) - creates its own HTTP server
 * 2. Inject: attachWebSocketToServer(options) - attaches to existing HTTP server
 */

export { createWebSocketServer, attachWebSocketToServer } from '../websocket-server.js';
