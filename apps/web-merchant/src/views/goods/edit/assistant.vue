<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { Button, message } from 'ant-design-vue';

import { requestClient } from '#/api/request';

type ChatMessage = { role: 'assistant' | 'user'; content: string };

const props = defineProps<{
  getDraft: () => Record<string, unknown>;
}>();

const emit = defineEmits<{
  apply: [product: Record<string, unknown>];
}>();

const accept = '.jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.json,.xls,.xlsx';
const tips = [
  { title: '一句话报价', line: '名称、单位、售价和库存', prompt: '新黄心土豆，按斤卖，售价 3.5 元，划线价 4.8 元，库存 80，产自云南，适合炖烤。' },
  { title: '多个规格', line: '先写分组，再写每一档', prompt: '红富士苹果分两档：5 斤装售价 29.9、库存 40；10 斤装售价 52、库存 20。脆甜，产自陕西。' },
  { title: '上传资料', line: '选中后立刻识别', prompt: '请根据我上传的附件识别商品，并填好名称、规格、价格和详情。' },
];
const guides = ['说出名称、价格、单位、库存和产地', '选中附件后会填入文字，并上传里面的图片', '填完后核对三步，再保存或提交'];

const open = ref(true);
const sending = ref(false);
const fileOver = ref(false);
const dragging = ref(false);
const text = ref('');
const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    content: '我可以帮你填好基础信息、规格和详情。直接说，或把资料拖进来。',
  },
]);
const listRef = ref<HTMLElement>();
const panelRef = ref<HTMLElement>();
const composerRef = ref<HTMLTextAreaElement>();
const position = ref(defaultPosition());
const showTips = ref(true);

function defaultPosition() {
  const width = Math.min(400, window.innerWidth - 24);
  const height = Math.min(620, window.innerHeight - 24);
  return {
    x: Math.max(12, window.innerWidth - width - 28),
    y: Math.max(12, window.innerHeight - height - 96),
  };
}

function clampPosition() {
  const panel = panelRef.value;
  const width = panel?.offsetWidth ?? Math.min(400, window.innerWidth - 24);
  const height = panel?.offsetHeight ?? Math.min(620, window.innerHeight - 24);
  position.value = {
    x: Math.min(Math.max(8, position.value.x), Math.max(8, window.innerWidth - width - 8)),
    y: Math.min(Math.max(8, position.value.y), Math.max(8, window.innerHeight - height - 8)),
  };
}

function onPointerDown(event: PointerEvent) {
  if ((event.target as HTMLElement).closest('button')) return;
  const panel = panelRef.value;
  if (!panel) return;
  dragging.value = true;
  const origin = { ...position.value };
  const startX = event.clientX;
  const startY = event.clientY;
  const move = (ev: PointerEvent) => {
    position.value = {
      x: origin.x + ev.clientX - startX,
      y: origin.y + ev.clientY - startY,
    };
    clampPosition();
  };
  const up = () => {
    dragging.value = false;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function chosenFiles(list: FileList | File[] | null) {
  const next: File[] = [];
  if (!list) return next;
  for (const file of list) {
    if (next.length >= 4) {
      message.warning('一次最多上传 4 个附件');
      break;
    }
    if (file.size > 15 * 1024 * 1024) {
      message.warning(`「${file.name}」超过 15MB`);
      continue;
    }
    next.push(file);
  }
  return next;
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement;
  const picked = chosenFiles(input.files);
  input.value = '';
  if (picked.length) send(picked);
}

function onDragOver(event: DragEvent) {
  if (![...(event.dataTransfer?.types || [])].includes('Files')) return;
  event.preventDefault();
  fileOver.value = true;
}

function onDrop(event: DragEvent) {
  fileOver.value = false;
  if (![...(event.dataTransfer?.types || [])].includes('Files')) return;
  const picked = chosenFiles(event.dataTransfer?.files || null);
  if (picked.length) send(picked);
}

function useTip(prompt: string) {
  text.value = prompt;
  composerRef.value?.focus();
}

async function scrollList() {
  await nextTick();
  if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight;
}

async function send(attachments: File[] = []) {
  const messageText = text.value.trim();
  if (sending.value) {
    if (attachments.length) message.warning('正在识别，请稍后再添加附件');
    return;
  }
  if (!messageText && !attachments.length) return;
  const pending = attachments;
  const outgoing = messageText || '请根据附件识别并填写商品信息。';
  const history = messages.value
    .slice(1)
    .slice(-8)
    .map((item) => ({ role: item.role, content: item.content }));
  messages.value.push({
    role: 'user',
    content: [messageText, ...pending.map((file) => `附件：${file.name}`)].filter(Boolean).join('\n'),
  });
  showTips.value = false;
  text.value = '';
  sending.value = true;
  await scrollList();
  try {
    const body = new FormData();
    body.append('message', outgoing);
    body.append('draft', JSON.stringify(props.getDraft()));
    body.append('history', JSON.stringify(history));
    pending.forEach((file) => body.append('files', file));
    const result = await requestClient.post<{ product?: Record<string, unknown>; reply?: string }>(
      '/products/assistant',
      body,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180_000 },
    );
    if (result.product) emit('apply', result.product);
    messages.value.push({
      role: 'assistant',
      content: result.reply || (result.product ? '已填入表单，请核对三步内容。' : '还没有足够的信息，可以继续补充。'),
    });
  } catch {
    messages.value.push({ role: 'assistant', content: '这次没有完成，请稍后再试，或换一种说法。' });
  } finally {
    sending.value = false;
    await scrollList();
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    send();
  }
}

onMounted(() => {
  clampPosition();
  window.addEventListener('resize', clampPosition);
});
onBeforeUnmount(() => window.removeEventListener('resize', clampPosition));
</script>

<template>
  <section
    v-show="open"
    ref="panelRef"
    class="panel"
    :class="{ dragging }"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @dragleave="fileOver = false"
    @dragover="onDragOver"
    @drop.prevent="onDrop"
  >
    <header @pointerdown="onPointerDown">
      <i class="mark">AI</i>
      <div class="title">
        <b>商品助手</b>
        <small>按住这里，可以拖到屏幕任意位置</small>
      </div>
      <button type="button" aria-label="收起商品助手" @click="open = false">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8" /></svg>
      </button>
    </header>
    <div ref="listRef" class="messages">
      <article v-for="(item, index) in messages" :key="index" :class="item.role">
        <p>{{ item.content }}</p>
      </article>
      <div v-if="showTips" class="hints">
        <span>可以这样开始</span>
        <button v-for="tip in tips" :key="tip.title" type="button" @click="useTip(tip.prompt)">
          <b>{{ tip.title }}</b>
          <small>{{ tip.line }}</small>
        </button>
        <ul>
          <li v-for="guide in guides" :key="guide">{{ guide }}</li>
        </ul>
      </div>
      <article v-if="sending" class="assistant pending"><p>正在识别并填写…</p></article>
    </div>
    <div v-if="fileOver" class="drop">松开后立刻开始识别</div>
    <footer>
      <textarea
        ref="composerRef"
        v-model="text"
        :disabled="sending"
        placeholder="输入文字后发送。选择附件会立刻开始识别"
        rows="3"
        @keydown="onKeydown"
      ></textarea>
      <div class="actions">
        <label class="clip">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 8.8 9.4 5.6a2 2 0 0 1 2.8 2.8l-4 4a3 3 0 0 1-4.2-4.2l4.2-4.2" /></svg>
          附件
          <input :accept="accept" aria-label="上传附件" multiple type="file" @change="onPick" />
        </label>
        <em>附件选中即识别</em>
        <Button :disabled="sending || !text.trim()" :loading="sending" type="primary" @click="send()">
          发送
        </Button>
      </div>
    </footer>
  </section>
  <button v-show="!open" class="launcher" type="button" @click="open = true">
    <i>AI</i>
    <span>商品助手</span>
  </button>
</template>

<style scoped>
.launcher { position: fixed; right: 28px; bottom: 88px; z-index: 1100; display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 16px 0 8px; border: 0; border-radius: 999px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); box-shadow: 0 12px 28px hsl(var(--primary) / 30%); cursor: pointer; }
.launcher i { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 50%; background: hsl(var(--primary-foreground) / 16%); font-style: normal; font-size: 12px; font-weight: 750; }
.panel { position: fixed; top: 0; left: 0; z-index: 1100; display: flex; width: min(400px, calc(100vw - 16px)); height: min(640px, calc(100vh - 16px)); flex-direction: column; overflow: hidden; border: 1px solid hsl(var(--border)); border-radius: 20px; background: hsl(var(--card)); box-shadow: 0 22px 60px hsl(var(--foreground) / 18%); }
.panel.dragging { cursor: grabbing; user-select: none; }
.panel header { display: flex; flex: none; align-items: center; gap: 12px; padding: 14px 14px 12px; background: linear-gradient(145deg, hsl(var(--primary) / 28%), hsl(var(--card)) 68%); cursor: grab; touch-action: none; }
.panel.dragging header { cursor: grabbing; }
.mark { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border-radius: 12px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); font-style: normal; font-size: 12px; font-weight: 750; }
.title { min-width: 0; flex: 1; }
.title b { display: block; color: hsl(var(--foreground)); font-size: 15px; }
.title small { color: hsl(var(--muted-foreground)); font-size: 12px; }
.panel header > button { display: grid; width: 30px; height: 30px; flex: none; place-items: center; border: 0; border-radius: 10px; background: hsl(var(--card) / 70%); color: hsl(var(--foreground)); cursor: pointer; }
.panel header > button svg { width: 16px; height: 16px; fill: none; stroke: currentcolor; stroke-width: 1.8; stroke-linecap: round; }
.messages { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 12px; overflow: auto; padding: 14px; }
.messages article p { max-width: 92%; margin: 0; padding: 10px 12px; border-radius: 14px; line-height: 1.6; white-space: pre-wrap; }
.messages .assistant p { background: hsl(var(--accent)); color: hsl(var(--foreground)); border-bottom-left-radius: 4px; }
.messages .user { display: flex; justify-content: flex-end; }
.messages .user p { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-bottom-right-radius: 4px; }
.messages .pending p { color: hsl(var(--muted-foreground)); }
.hints { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px dashed hsl(var(--primary) / 35%); border-radius: 16px; background: linear-gradient(180deg, hsl(var(--primary) / 10%), hsl(var(--card)) 70%); }
.hints > span { color: hsl(var(--muted-foreground)); font-size: 12px; font-weight: 650; }
.hints > button { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid hsl(var(--border)); border-radius: 12px; background: hsl(var(--card)); color: hsl(var(--foreground)); text-align: left; cursor: pointer; }
.hints > button:hover { border-color: hsl(var(--primary) / 55%); background: hsl(var(--primary) / 8%); }
.hints > button b { font-size: 13px; }
.hints > button small, .hints li { color: hsl(var(--muted-foreground)); font-size: 12px; }
.hints ul { display: flex; flex-direction: column; gap: 4px; margin: 2px 0 0; padding-left: 18px; }
.drop { margin: 0 14px 8px; padding: 10px; border: 1px dashed hsl(var(--primary)); border-radius: 12px; background: hsl(var(--primary) / 10%); color: hsl(var(--primary)); text-align: center; font-size: 13px; font-weight: 650; }
.panel footer { display: flex; flex: none; flex-direction: column; gap: 8px; padding: 12px; border-top: 1px solid hsl(var(--border)); background: hsl(var(--card)); }
textarea { width: 100%; min-height: 72px; max-height: 120px; resize: none; padding: 10px 12px; border: 1px solid hsl(var(--border)); border-radius: 12px; background: hsl(var(--background)); color: hsl(var(--foreground)); outline: none; }
textarea:focus { border-color: hsl(var(--primary) / 60%); }
.actions { display: flex; align-items: center; gap: 8px; }
.clip { position: relative; display: inline-flex; overflow: hidden; height: 32px; align-items: center; gap: 6px; padding: 0 10px; border: 1px solid hsl(var(--border)); border-radius: 999px; background: hsl(var(--card)); cursor: pointer; }
.clip svg { width: 14px; height: 14px; fill: none; stroke: currentcolor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.clip input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.actions em { margin-right: auto; color: hsl(var(--muted-foreground)); font-size: 12px; font-style: normal; }
</style>
