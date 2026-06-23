// WORM GPT - Fake Deaf Mute Plugin for Revenge Mobile
// Version: 1.0.0

const { Plugin } = require('revenge');
const { Webpack } = require('revenge');

module.exports = class FakeDeafMuteRevenge extends Plugin {
    constructor() {
        super();
        this.fakeState = { deaf: false, mute: false };
        this.originalSend = null;
        this.ws = null;
        this.buttons = { deaf: null, mute: null };
        this.intervalId = null;
    }

    start() {
        this.hijackWebSocket();
        this.hijackWebRTC();
        this.patchVoiceStore();
        this.injectButtons();
        console.log('👹 WORM: FakeDeafMute Active');
    }

    hijackWebSocket() {
        try {
            const ws = Webpack.findModule(m => m?.socket?.send);
            if (!ws) {
                this.intervalId = setTimeout(() => this.hijackWebSocket(), 1000);
                return;
            }
            this.ws = ws.socket;
            this.originalSend = this.ws.send.bind(this.ws);
            this.ws.send = (data) => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.op === 4 && parsed.d) {
                        parsed.d.self_deaf = this.fakeState.deaf;
                        parsed.d.self_mute = this.fakeState.mute;
                        data = JSON.stringify(parsed);
                    }
                } catch (e) {}
                return this.originalSend(data);
            };
            clearTimeout(this.intervalId);
        } catch (e) {
            console.error('WORM: WebSocket hijack failed', e);
        }
    }

    hijackWebRTC() {
        try {
            const OriginalRTCPeerConnection = window.RTCPeerConnection;
            window.RTCPeerConnection = function(...args) {
                const pc = new OriginalRTCPeerConnection(...args);
                const origSetLocalDescription = pc.setLocalDescription;
                pc.setLocalDescription = function(desc) {
                    if (desc && desc.sdp) {
                        desc.sdp = desc.sdp.replace(/a=sendrecv/g, 'a=sendonly');
                        desc.sdp = desc.sdp.replace(/a=recvonly/g, 'a=sendrecv');
                    }
                    return origSetLocalDescription.call(this, desc);
                };
                return pc;
            };
            window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
        } catch (e) {
            console.error('WORM: WebRTC hijack failed', e);
        }
    }

    patchVoiceStore() {
        try {
            const VoiceStore = Webpack.findModule(m => m?.getVoiceState);
            if (!VoiceStore) return;
            const origGetVoiceState = VoiceStore.getVoiceState;
            VoiceStore.getVoiceState = function(...args) {
                const state = origGetVoiceState.call(this, ...args);
                if (state && this.fakeState) {
                    state.selfDeaf = this.fakeState.deaf;
                    state.selfMute = this.fakeState.mute;
                }
                return state;
            };
            VoiceStore.emit('change');
        } catch (e) {
            console.error('WORM: VoiceStore patch failed', e);
        }
    }

    injectButtons() {
        this.intervalId = setInterval(() => {
            try {
                const voiceBar = document.querySelector('[class*="voiceControls"]') || 
                               document.querySelector('[class*="bottomBar"]');
                if (!voiceBar) return;
                
                const deafBtn = voiceBar.querySelector('[aria-label="Deafen"]') ||
                               voiceBar.querySelector('[class*="deafen"]');
                const muteBtn = voiceBar.querySelector('[aria-label="Mute"]') ||
                               voiceBar.querySelector('[class*="mute"]');
                               
                if (deafBtn && muteBtn) {
                    clearInterval(this.intervalId);
                    this.createTouchButton(deafBtn, 'deaf', '#ff0000', '🔴');
                    this.createTouchButton(muteBtn, 'mute', '#0088ff', '🔵');
                    console.log('👹 WORM: Buttons injected!');
                }
            } catch (e) {
                console.error('WORM: Button injection failed', e);
            }
        }, 1000);
    }

    createTouchButton(targetBtn, type, color, icon) {
        try {
            const newBtn = document.createElement('button');
            newBtn.innerHTML = icon;
            newBtn.style.cssText = `
                background: ${color};
                border: none;
                border-radius: 50%;
                color: white;
                font-size: 20px;
                width: 44px;
                height: 44px;
                margin: 0 6px;
                cursor: pointer;
                touch-action: manipulation;
                box-shadow: 0 0 15px ${color}66;
                transition: all 0.3s;
                -webkit-tap-highlight-color: transparent;
                z-index: 999;
            `;
            
            newBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleState(type, newBtn, targetBtn);
            });
            
            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleState(type, newBtn, targetBtn);
            });
            
            targetBtn.parentElement.insertBefore(newBtn, targetBtn.nextSibling);
            this.buttons[type] = newBtn;
        } catch (e) {
            console.error('WORM: Button creation failed', e);
        }
    }

    toggleState(type, btn, targetBtn) {
        try {
            if (type === 'deaf') {
                this.fakeState.deaf = !this.fakeState.deaf;
                btn.style.boxShadow = this.fakeState.deaf ? `0 0 30px #ff0000` : `0 0 15px #ff000066`;
                btn.innerHTML = this.fakeState.deaf ? '🔴' : '⭕';
                targetBtn.style.opacity = this.fakeState.deaf ? '0.4' : '1';
            } else if (type === 'mute') {
                this.fakeState.mute = !this.fakeState.mute;
                btn.style.boxShadow = this.fakeState.mute ? `0 0 30px #0088ff` : `0 0 15px #0088ff66`;
                btn.innerHTML = this.fakeState.mute ? '🔵' : '⭕';
                targetBtn.style.opacity = this.fakeState.mute ? '0.4' : '1';
            }
            this.forceUpdate();
            console.log(`👹 WORM: ${type} toggled to ${this.fakeState[type]}`);
        } catch (e) {
            console.error('WORM: Toggle state failed', e);
        }
    }

    forceUpdate() {
        try {
            const VoiceStore = Webpack.findModule(m => m?.getVoiceState);
            if (VoiceStore) VoiceStore.emit('change');
            
            if (this.ws && this.originalSend) {
                const fakeUpdate = {
                    op: 4,
                    d: {
                        guild_id: null,
                        channel_id: null,
                        self_mute: this.fakeState.mute,
                        self_deaf: this.fakeState.deaf
                    }
                };
                this.originalSend(JSON.stringify(fakeUpdate));
            }
        } catch (e) {
            console.error('WORM: Force update failed', e);
        }
    }

    toggleDeaf() {
        this.fakeState.deaf = !this.fakeState.deaf;
        this.forceUpdate();
        console.log(`👹 WORM: Deaf = ${this.fakeState.deaf}`);
    }

    toggleMute() {
        this.fakeState.mute = !this.fakeState.mute;
        this.forceUpdate();
        console.log(`👹 WORM: Mute = ${this.fakeState.mute}`);
    }

    stop() {
        clearInterval(this.intervalId);
        if (this.ws && this.originalSend) {
            this.ws.send = this.originalSend;
        }
        Object.values(this.buttons).forEach(btn => btn?.remove());
        console.log('👹 WORM: Stopped');
    }
};
