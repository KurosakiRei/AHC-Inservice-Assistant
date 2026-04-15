<template>
  <div class="ia-overlay">
    <div class="ia-modal" :style="{ top: modalY + 'px', left: modalX + 'px' }">
      <h2 @mousedown.prevent="startDrag" class="drag-handle">
        <span style="margin-right:8px;">✨</span> Inservice Assistant
      </h2>
      <p>Training environment detected.<br>I can automatically complete the videos and answer the questionnaires for
        you.</p>

      <div class="ia-status-text">
        {{ logMessage }}
      </div>

      <button v-if="!isAutomating" @click="toggleAutomation(true)" class="ia-btn">Start Automation</button>
      <button v-else @click="toggleAutomation(false)" class="ia-btn danger">Stop Automation</button>

      <div class="ia-footer">
        <span class="ia-version">v 1.1.2</span>
        <span class="ia-credit">Powered by KurosakiRei</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onUnmounted, ref } from 'vue';
import { AutomationEngine } from './AutomationEngine';

export default defineComponent({
  name: 'App',
  setup() {
    const isAutomating = ref(false);
    const logMessage = ref('Waiting to start...');
    let engine: AutomationEngine | null = null;

    // Draggable State
    const modalX = ref(window.innerWidth > 360 ? window.innerWidth - 340 : 20);
    const modalY = ref(20);
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialX = 0;
    let initialY = 0;

    const startDrag = (e: MouseEvent) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialX = modalX.value;
      initialY = modalY.value;
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', stopDrag);
    };

    const onDrag = (e: MouseEvent) => {
      if (!isDragging) return;
      let newX = initialX + (e.clientX - dragStartX);
      let newY = initialY + (e.clientY - dragStartY);

      const maxW = window.innerWidth - 300;
      const maxH = window.innerHeight - 80;

      if (newX < 0) newX = 0;
      if (newX > maxW) newX = maxW;
      if (newY < 0) newY = 0;
      if (newY > maxH) newY = maxH;

      modalX.value = newX;
      modalY.value = newY;
    };

    const stopDrag = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', stopDrag);
    };

    onUnmounted(() => {
      stopDrag();
    });

    onMounted(() => {
      // Always start in stopped state — and actively clear any stale sessionStorage
      // value that may have persisted from an earlier navigation in the same tab.
      isAutomating.value = false;
      try { sessionStorage.removeItem('ia_automating'); } catch (e) { }

      engine = new AutomationEngine((msg: string) => {
        logMessage.value = msg;
      });

      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'IA_LOG') {
          logMessage.value = e.data.message;
        }
      });
    });

    const toggleAutomation = (status: boolean) => {
      isAutomating.value = status;
      // Use sessionStorage (clears on tab close/refresh) instead of
      // GM_setValue/localStorage which persist and cause auto-start
      try {
        sessionStorage.setItem('ia_automating', String(status));
      } catch (e) { }

      if (engine) engine.setAutomating(status);
      logMessage.value = status ? 'Automation started. Checking content...' : 'Automation stopped.';
    };

    return {
      isAutomating,
      logMessage,
      toggleAutomation,
      modalX,
      modalY,
      startDrag
    };
  }
});
</script>

<style scoped>
.ia-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 999999;
  font-family: 'Inter', system-ui, sans-serif;
  color: #333;
  transition: opacity 0.3s ease;
  pointer-events: none;
  /* Let clicks pass through the overlay container */
}

.ia-modal {
  position: absolute;
  pointer-events: auto;
  /* Re-enable clicks for the modal itself */
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  text-align: center;
  width: 320px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.drag-handle {
  cursor: move;
  user-select: none;
  margin-top: -10px;
  margin-left: -10px;
  margin-right: -10px;
  color: #111;
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: 16px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ia-modal p {
  color: #555;
  line-height: 1.4;
  margin-bottom: 16px;
  font-size: 0.9rem;
}

.ia-status-text {
  font-size: 0.85em;
  padding: 10px;
  background: #f4f6f8;
  border-radius: 8px;
  margin-bottom: 16px;
  min-height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2c3e50;
  font-weight: 500;
  word-break: break-word;
}

.ia-btn {
  background: #0066ff;
  color: white;
  border: none;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.1s, background 0.2s;
  width: 100%;
}

.ia-btn:hover {
  background: #0052cc;
  transform: translateY(-1px);
}

.ia-btn.danger {
  background: #e74c3c;
  margin-top: 8px;
}

.ia-btn.danger:hover {
  background: #c0392b;
}

.ia-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #eef0f3;
  font-size: 0.72rem;
  color: #aaa;
}

.ia-version {
  font-weight: 600;
  letter-spacing: 0.03em;
}

.ia-credit {
  font-style: italic;
}
</style>
