<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Input,
  message,
  Modal,
  Radio,
  Spin,
  Table,
} from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Activity = {
  activityNo?: string;
  end?: string;
  id: number;
  name: string;
  reviewRemark?: string;
  scope: string;
  shopName: string;
  start?: string;
  status: string;
  statusName: string;
  summary: string;
  typeName: string;
};

type Rule = {
  amount?: number | string;
  cut?: number | string;
  limit?: number | string;
  min?: number | string;
  mode?: string;
  qty?: number | string;
  rate?: number | string;
  slot?: string;
  stack?: string;
  threshold?: number | string;
  tiers?: { qty?: number | string; rate?: number | string }[];
};

type SkuItem = {
  name: string;
  price: string;
  salePrice: string;
  spec: string;
  stock: number;
};

type Detail = Activity & {
  items?: SkuItem[];
  note?: string;
  rule?: Rule;
  type?: string;
};

const rows = ref<Activity[]>([]);
const filter = ref('PENDING');
const keyword = ref('');
const loading = ref(false);
const current = ref<Activity | null>(null);
const detail = ref<Detail | null>(null);
const detailLoading = ref(false);
const remark = ref('');
const acting = ref(false);

const columns: TableColumnsType<Activity> = [
  { title: '活动', key: 'activity' },
  { title: '规则', key: 'summary', width: 240 },
  { title: '状态', key: 'status', width: 160 },
  { title: '操作', key: 'action', width: 110 },
];

const types = [
  { name: '满减', tone: 'cut', mark: '减' },
  { name: '优惠券', tone: 'coupon', mark: '券' },
  { name: '折扣', tone: 'off', mark: '折' },
  { name: '秒杀', tone: 'flash', mark: '秒' },
];

const counts = computed(() => ({
  active: rows.value.filter((item) => item.status === 'ACTIVE').length,
  pending: rows.value.filter((item) => item.status === 'PENDING').length,
  rejected: rows.value.filter((item) => item.status === 'REJECTED').length,
}));

const visible = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return rows.value.filter((item) => {
    if (filter.value !== 'ALL' && item.status !== filter.value) return false;
    if (!query) return true;
    return [
      item.name,
      item.summary,
      item.typeName,
      item.activityNo,
      item.scope,
      item.shopName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
});

const shown = computed(() => detail.value || current.value);
const pending = computed(() => shown.value?.status === 'PENDING');
const typeTone = computed(() => typeOf(shown.value?.typeName || '').tone);
const groups = computed(() => {
  const map = new Map<string, SkuItem[]>();
  for (const item of detail.value?.items || []) {
    const list = map.get(item.name) || [];
    list.push(item);
    map.set(item.name, list);
  }
  return [...map.entries()].map(([name, skus]) => ({ name, skus }));
});
const merchantNote = computed(() => {
  const note = (detail.value?.note || '').trim();
  return pending.value && note ? note : '';
});
const rejectNote = computed(() => {
  const note = (shown.value?.reviewRemark || '').trim();
  return shown.value?.status === 'REJECTED' && note ? note : '';
});

function typeOf(name: string) {
  return (
    types.find((item) => item.name === name) || {
      mark: name.slice(0, 1) || '活',
      name,
      tone: 'cut',
    }
  );
}

function period(item: null | { end?: string; start?: string }) {
  const start = (item?.start || '').slice(5, 16);
  const end = (item?.end || '').slice(5, 16);
  return start && end ? `${start} 至 ${end}` : '时间未设置';
}

function text(value: unknown, fallback = '—') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function sentence(item: Activity | Detail | null) {
  const rule = item && 'rule' in item ? item.rule : undefined;
  const type = item?.typeName;
  if (!rule || !type) return item?.summary || '未设置规则';
  if (type === '满减') {
    const mode = rule.mode === '每满一次减' ? '每满' : '满';
    return `${mode} ${text(rule.threshold)} 元，减 ${text(rule.cut)} 元`;
  }
  if (type === '优惠券') {
    const min = Number(rule.min) > 0 ? `满 ${text(rule.min)} 元` : '无门槛';
    return `${min}，抵 ${text(rule.amount)} 元`;
  }
  if (type === '折扣' && rule.mode === '多件折扣') {
    const tiers = (rule.tiers || []).map(
      (tier) => `满 ${text(tier.qty)} 件打 ${text(tier.rate)} 折`,
    );
    return tiers.join('、') || item?.summary || '未设置规则';
  }
  if (type === '折扣') return `统一 ${text(rule.rate)} 折`;
  return `${text(rule.slot, '未设场次')} 场`;
}

function extras(item: Detail | null) {
  const rule = item?.rule;
  if (!rule) return [];
  if (item.typeName === '优惠券') {
    return [
      `发放 ${text(rule.qty, '0')} 张`,
      `每人限领 ${text(rule.limit, '1')} 张`,
    ];
  }
  if (item.typeName === '折扣') {
    return [
      `每人限 ${text(rule.limit, '1')} 件`,
      rule.stack || '不可与优惠券同享',
    ];
  }
  if (item.typeName === '秒杀') return [`每人限购 ${text(rule.limit, '1')} 件`];
  return [rule.mode || '满一次减'];
}

async function load() {
  loading.value = true;
  try {
    rows.value = await requestClient.get<Activity[]>('/activities');
  } finally {
    loading.value = false;
  }
}

async function openAudit(record: Activity | Record<string, any>) {
  const item = record as Activity;
  current.value = item;
  detail.value = null;
  remark.value = '';
  detailLoading.value = true;
  try {
    detail.value = await requestClient.get<Detail>(`/activities/${item.id}`);
  } finally {
    detailLoading.value = false;
  }
}

function close() {
  if (acting.value) return;
  current.value = null;
}

async function audit(pass: boolean) {
  if (!current.value) return;
  if (!pass && !remark.value.trim()) {
    message.warning('驳回时请填写原因');
    return;
  }
  acting.value = true;
  try {
    await requestClient.post(`/activities/${current.value.id}/audit`, {
      pass,
      remark: remark.value,
    });
    message.success(pass ? '已通过，活动已生效' : '已驳回');
    current.value = null;
    await load();
  } finally {
    acting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page
    description="优惠券和秒杀提交后进入这里审核。通过后顾客才能使用，驳回时需要写明原因。"
    title="活动审核"
  >
    <div class="board">
      <button
        class="metric warn"
        :class="{ on: filter === 'PENDING' }"
        type="button"
        @click="filter = 'PENDING'"
      >
        <span>待审核</span>
        <b>{{ counts.pending }}</b>
        <small>通过后才会出现在顾客结算里</small>
      </button>
      <button
        class="metric sale"
        :class="{ on: filter === 'ACTIVE' }"
        type="button"
        @click="filter = 'ACTIVE'"
      >
        <span>进行中</span>
        <b>{{ counts.active }}</b>
        <small>正在参与顾客结算</small>
      </button>
      <button
        class="metric reject"
        :class="{ on: filter === 'REJECTED' }"
        type="button"
        @click="filter = 'REJECTED'"
      >
        <span>已驳回</span>
        <b>{{ counts.rejected }}</b>
        <small>商家可以修改后重新提交</small>
      </button>
      <Card class="panel">
        <div class="toolbar">
          <Input
            v-model:value="keyword"
            allow-clear
            class="search"
            placeholder="搜索活动、店铺或规则"
          />
          <Radio.Group v-model:value="filter" button-style="solid">
            <Radio.Button value="PENDING">待审核</Radio.Button>
            <Radio.Button value="ACTIVE">进行中</Radio.Button>
            <Radio.Button value="REJECTED">已驳回</Radio.Button>
            <Radio.Button value="ENDED">已结束</Radio.Button>
            <Radio.Button value="ALL">全部</Radio.Button>
          </Radio.Group>
          <Button class="refresh" @click="load">刷新</Button>
        </div>
        <Table
          :columns="columns"
          :data-source="visible"
          :loading="loading"
          :locale="{
            emptyText:
              filter === 'PENDING'
                ? '当前没有待审核的活动'
                : '没有符合条件的活动',
          }"
          :pagination="{
            pageSize: 8,
            showTotal: (total: number) => `共 ${total} 个活动`,
          }"
          row-key="id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'activity'">
              <button class="activity" type="button" @click="openAudit(record)">
                <i class="mark" :class="typeOf(record.typeName).tone">{{
                  typeOf(record.typeName).mark
                }}</i>
                <span class="copy">
                  <b>{{ record.name }}</b>
                  <small>{{ record.shopName }} · {{ record.typeName }} ·
                    {{ record.scope }}</small>
                  <small>{{ period(record) }} ·
                    {{ record.activityNo || '未编号' }}</small>
                </span>
              </button>
            </template>
            <template v-else-if="column.key === 'summary'">
              <b class="rule-text">{{ record.summary || '未设置规则' }}</b>
            </template>
            <template v-else-if="column.key === 'status'">
              <div class="state-cell">
                <span class="state" :class="record.status">
                  <i></i>
                  {{ record.statusName }}
                </span>
                <p
                  v-if="record.status === 'REJECTED' && record.reviewRemark"
                  class="state-note"
                >
                  {{ record.reviewRemark }}
                </p>
              </div>
            </template>
            <template v-else-if="column.key === 'action'">
              <Button
                v-if="record.status === 'PENDING'"
                size="small"
                type="link"
                @click="openAudit(record)"
              >
                审核
              </Button>
              <Button
                v-else
                size="small"
                type="link"
                @click="openAudit(record)"
              >
                查看
              </Button>
            </template>
          </template>
        </Table>
      </Card>
    </div>

    <Modal
      :footer="null"
      :open="!!current"
      :title="null"
      width="760px"
      wrap-class-name="audit-modal"
      @cancel="close"
    >
      <div v-if="shown" class="sheet">
        <header class="hero" :class="typeTone">
          <div>
            <span>{{ pending ? '审核活动' : '活动详情' }} ·
              {{ shown.typeName }}</span>
            <b>{{ shown.name }}</b>
            <p>{{ shown.shopName }} · {{ shown.activityNo || '未编号' }}</p>
          </div>
          <em>{{ shown.statusName }}</em>
        </header>
        <Spin :spinning="detailLoading">
          <div class="sheet-body">
            <section class="block rule" :class="typeTone">
              <header>
                <b>优惠规则</b>
                <span>{{ shown.summary || '未设置规则' }}</span>
              </header>
              <div class="block-body">
                <div class="sentence">{{ sentence(detail || shown) }}</div>
                <div v-if="extras(detail).length" class="chips">
                  <span
                    v-for="item in extras(detail)"
                    :key="item"
                    class="chip"
                    >{{ item }}</span>
                </div>
                <div class="facts">
                  <div>
                    <span>店铺</span>
                    <b>{{ shown.shopName || '—' }}</b>
                  </div>
                  <div>
                    <span>范围</span>
                    <b>{{ shown.scope || '—' }}</b>
                  </div>
                  <div>
                    <span>开始</span>
                    <b>{{ (shown.start || '').slice(0, 16) || '—' }}</b>
                  </div>
                  <div>
                    <span>结束</span>
                    <b>{{ (shown.end || '').slice(0, 16) || '—' }}</b>
                  </div>
                </div>
                <div
                  v-for="group in groups"
                  :key="group.name"
                  class="sku-group"
                >
                  <b>{{ group.name }}</b>
                  <article
                    v-for="item in group.skus"
                    :key="`${group.name}-${item.spec}`"
                    class="sku"
                  >
                    <div class="sku-copy">
                      <b>{{ item.spec }}</b>
                      <small>售价 ¥{{ item.salePrice }}</small>
                    </div>
                    <div class="sku-price">
                      <b>¥{{ item.price }}</b>
                      <small>秒杀库存 {{ item.stock }}</small>
                    </div>
                  </article>
                </div>
              </div>
            </section>

            <section v-if="merchantNote" class="block">
              <header>
                <b>商家备注</b>
                <span>提交时填写</span>
              </header>
              <div class="block-body">
                <p class="note">{{ merchantNote }}</p>
              </div>
            </section>

            <section v-if="rejectNote" class="block">
              <header>
                <b>驳回原因</b>
                <span>商家修改后可以再次提交</span>
              </header>
              <div class="block-body">
                <p class="note warn">{{ rejectNote }}</p>
              </div>
            </section>

            <section v-if="pending" class="block">
              <header>
                <b>审核意见</b>
                <span>驳回时必填</span>
              </header>
              <div class="block-body">
                <Input.TextArea
                  v-model:value="remark"
                  :maxlength="120"
                  :rows="3"
                  placeholder="通过可以留空。驳回请写明原因，商家会看到这段说明。"
                  show-count
                />
              </div>
            </section>
          </div>
        </Spin>
        <footer class="sheet-foot">
          <p>
            {{
              pending
                ? '通过后活动立即生效。驳回后商家可以修改并重新提交。'
                : '这里只核对活动内容，状态不会改变。'
            }}
          </p>
          <div>
            <Button @click="close">{{ pending ? '取消' : '关闭' }}</Button>
            <Button
              v-if="pending"
              danger
              :loading="acting"
              @click="audit(false)"
            >
              驳回
            </Button>
            <Button
              v-if="pending"
              :loading="acting"
              type="primary"
              @click="audit(true)"
            >
              审核通过
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.panel {
  grid-column: 1 / -1;
  overflow: hidden;
  border-radius: 14px;
}

.metric {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  min-height: 112px;
  padding: 18px 20px;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  isolation: isolate;
}

.metric::before,
.metric::after {
  position: absolute;
  pointer-events: none;
  content: '';
}

.metric::before {
  inset: 0;
  z-index: -1;
}

.metric::after {
  top: -36px;
  right: -28px;
  z-index: -1;
  width: 120px;
  height: 120px;
  border-radius: 50%;
}

.metric.sale::before {
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 28%),
    hsl(var(--card)) 58%
  );
}

.metric.sale::after {
  background: radial-gradient(
    circle,
    hsl(var(--primary) / 42%),
    transparent 68%
  );
}

.metric.warn::before {
  background: linear-gradient(
    145deg,
    hsl(var(--warning) / 26%),
    hsl(var(--card)) 58%
  );
}

.metric.warn::after {
  background: radial-gradient(
    circle,
    hsl(var(--warning) / 40%),
    transparent 68%
  );
}

.metric.reject::before {
  background: linear-gradient(
    145deg,
    hsl(var(--destructive) / 22%),
    hsl(var(--card)) 58%
  );
}

.metric.reject::after {
  background: radial-gradient(
    circle,
    hsl(var(--destructive) / 36%),
    transparent 68%
  );
}

.metric b {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  color: hsl(var(--foreground));
  letter-spacing: -0.03em;
}

.metric span {
  font-size: 13px;
  font-weight: 650;
  color: hsl(var(--foreground));
}

.metric small {
  max-width: 16em;
  font-size: 12px;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
}

.metric.sale.on {
  border-color: hsl(var(--primary) / 70%);
  box-shadow: 0 0 0 3px hsl(var(--primary) / 16%);
}

.metric.sale b {
  color: hsl(var(--primary));
}

.metric.warn.on {
  border-color: hsl(var(--warning) / 70%);
  box-shadow: 0 0 0 3px hsl(var(--warning) / 16%);
}

.metric.warn b {
  color: hsl(var(--warning));
}

.metric.reject.on {
  border-color: hsl(var(--destructive) / 65%);
  box-shadow: 0 0 0 3px hsl(var(--destructive) / 16%);
}

.metric.reject b {
  color: hsl(var(--destructive));
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 4px 4px 14px;
  margin-bottom: 4px;
  border-bottom: 1px solid hsl(var(--border));
}

.search {
  width: 280px;
}

.refresh {
  margin-left: auto;
}

.activity {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 280px;
  padding: 0;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  font-style: normal;
  font-weight: 750;
  border-radius: 12px;
}

.mark.cut {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 16%);
}

.mark.coupon {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 18%);
}

.mark.off {
  color: hsl(var(--success));
  background: hsl(var(--success) / 16%);
}

.mark.flash {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 16%);
}

.copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.copy b {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 650;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.copy small,
.idle {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.rule-text {
  font-weight: 650;
  color: hsl(var(--foreground));
}

.state-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.state {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  height: 28px;
  padding: 0 12px 0 10px;
  font-size: 12px;
  font-weight: 650;
  line-height: 1;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  background: hsl(var(--accent));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.state i {
  width: 7px;
  height: 7px;
  background: currentcolor;
  border-radius: 50%;
}

.state.ACTIVE {
  color: hsl(var(--success));
  background: hsl(var(--success) / 14%);
  border-color: hsl(var(--success) / 40%);
}

.state.ACTIVE i {
  box-shadow: 0 0 0 3px hsl(var(--success) / 22%);
}

.state.PENDING {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 14%);
  border-color: hsl(var(--warning) / 45%);
}

.state.PENDING i {
  box-shadow: 0 0 0 3px hsl(var(--warning) / 22%);
}

.state.REJECTED {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 12%);
  border-color: hsl(var(--destructive) / 45%);
}

.state.REJECTED i {
  box-shadow: 0 0 0 3px hsl(var(--destructive) / 20%);
}

.state-note {
  max-width: 12em;
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: hsl(var(--destructive));
}

.sheet {
  display: flex;
  flex-direction: column;
}

.hero {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 22px 56px 18px 22px;
}

.hero.cut {
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 28%),
    hsl(var(--card)) 68%
  );
}

.hero.coupon {
  background: linear-gradient(
    145deg,
    hsl(var(--warning) / 26%),
    hsl(var(--card)) 68%
  );
}

.hero.off {
  background: linear-gradient(
    145deg,
    hsl(var(--success) / 24%),
    hsl(var(--card)) 68%
  );
}

.hero.flash {
  background: linear-gradient(
    145deg,
    hsl(var(--destructive) / 24%),
    hsl(var(--card)) 68%
  );
}

.hero span,
.hero p {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.hero b {
  display: block;
  margin-top: 4px;
  font-size: 20px;
  color: hsl(var(--foreground));
  letter-spacing: -0.02em;
}

.hero p {
  margin: 6px 0 0;
}

.hero em {
  flex: none;
  padding: 4px 10px;
  margin-top: 4px;
  font-size: 12px;
  font-style: normal;
  font-weight: 650;
  color: hsl(var(--foreground));
  background: hsl(var(--card) / 80%);
  border-radius: 999px;
}

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: min(68vh, 640px);
  padding: 16px 22px 8px;
  overflow: auto;
}

.block {
  overflow: hidden;
  background: linear-gradient(
    180deg,
    hsl(var(--primary) / 10%),
    hsl(var(--card)) 48px
  );
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.block.rule.coupon {
  background: linear-gradient(
    180deg,
    hsl(var(--warning) / 12%),
    hsl(var(--card)) 48px
  );
}

.block.rule.off {
  background: linear-gradient(
    180deg,
    hsl(var(--success) / 12%),
    hsl(var(--card)) 48px
  );
}

.block.rule.flash {
  background: linear-gradient(
    180deg,
    hsl(var(--destructive) / 12%),
    hsl(var(--card)) 48px
  );
}

.block header {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
  padding: 12px 14px 8px;
}

.block header span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.block-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 14px 14px;
}

.facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.facts div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  background: hsl(var(--accent));
  border-radius: 12px;
}

.facts span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.facts b {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 650;
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
  border-radius: 999px;
}

.sentence {
  padding: 14px 16px;
  font-size: 18px;
  font-weight: 700;
  color: hsl(var(--foreground));
  letter-spacing: -0.02em;
  background: hsl(var(--card));
  border-radius: 12px;
}

.sku-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sku-group > b {
  font-size: 13px;
}

.sku {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.sku-copy,
.sku-price {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sku-price {
  flex: none;
  align-items: flex-end;
}

.sku-copy b,
.sku-price b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sku-copy small,
.sku-price small {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.sku-price b {
  color: hsl(var(--destructive));
}

.note {
  margin: 0;
  line-height: 1.6;
  color: hsl(var(--foreground));
}

.note.warn {
  color: hsl(var(--destructive));
}

.sheet-foot {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px;
  background: hsl(var(--card));
  border-top: 1px solid hsl(var(--border));
}

.sheet-foot p {
  margin: 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.sheet-foot div {
  display: flex;
  gap: 8px;
}
</style>

<style>
.audit-modal .ant-modal-content {
  padding: 0;
  overflow: hidden;
  border-radius: 18px;
}

.audit-modal .ant-modal-header {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  padding: 0;
  margin: 0;
  background: transparent;
  border: 0;
}

.audit-modal .ant-modal-title {
  display: none;
}

.audit-modal .ant-modal-body {
  padding: 0;
}

.audit-modal .ant-modal-close {
  color: hsl(var(--foreground));
}
</style>
