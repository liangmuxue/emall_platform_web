<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Modal, Table, Tag } from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Line = {
  amount: string;
  no?: string;
  orderNo: string;
  time: string;
  timing?: string;
};

type Bill = {
  adjustmentAmount: string;
  commissionAmount: string;
  id: number;
  no: string;
  orderAmount: string;
  orders?: Line[];
  paidAt?: string;
  payableAmount: string;
  period: string;
  rate: string;
  refundAmount: string;
  refunds?: Line[];
  shopName: string;
  status: string;
  statusName: string;
};

const rows = ref<Bill[]>([]);
const current = ref<Bill | null>(null);
const loading = ref(false);
const open = ref(false);
const detail = ref<Bill | null>(null);

const columns: TableColumnsType<Bill> = [
  { title: '结算单', dataIndex: 'no', key: 'no', width: 210 },
  { title: '账期', dataIndex: 'period', key: 'period', width: 210 },
  { title: '订单', key: 'order', width: 100 },
  { title: '退款', key: 'refund', width: 100 },
  { title: '佣金', key: 'commission', width: 100 },
  { title: '应付', key: 'payable', width: 110 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 80 },
];

const color: Record<string, string> = {
  PAID: 'green',
  PENDING_RECONCILE: 'blue',
  RECONCILED: 'gold',
};

async function load() {
  loading.value = true;
  try {
    rows.value = await requestClient.get<Bill[]>('/settlements');
    current.value = await requestClient.get<Bill>('/settlements/current');
  } finally {
    loading.value = false;
  }
}

async function show(row: Bill) {
  open.value = true;
  detail.value = await requestClient.get<Bill>(`/settlements/${row.id}`);
}

onMounted(load);
</script>

<template>
  <Page title="结算单">
    <div v-if="current" class="live">
      <div>
        <b>本周期进行中</b>
        <div class="muted">
          {{ current.period }} · 平台出账后才会出现在下面的列表
        </div>
      </div>
      <div>预计应付 ¥{{ current.payableAmount }}</div>
    </div>
    <p class="muted intro">已出的账由平台核对，店铺不能修改。</p>
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="{ pageSize: 10 }"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'order'">
          ¥{{ record.orderAmount }}
        </template>
        <template v-else-if="column.key === 'refund'">
          ¥{{ record.refundAmount }}
        </template>
        <template v-else-if="column.key === 'commission'">
          ¥{{ record.commissionAmount }}
        </template>
        <template v-else-if="column.key === 'payable'">
          ¥{{ record.payableAmount }}
        </template>
        <template v-else-if="column.key === 'status'">
          <Tag :color="color[record.status] || 'default'">
            {{ record.statusName }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <Button size="small" type="link" @click="show(record)">查看</Button>
        </template>
      </template>
    </Table>

    <Modal
      :footer="null"
      :open="open"
      title="结算单"
      width="720px"
      @cancel="open = false"
    >
      <template v-if="detail">
        <div class="hero">
          <div>
            <div class="no">{{ detail.no }}</div>
            <div class="muted">
              {{ detail.period }} · 佣金 {{ detail.rate }}
            </div>
          </div>
          <div class="money">¥{{ detail.payableAmount }}</div>
        </div>
        <div class="grid">
          <span>订单金额</span><b>¥{{ detail.orderAmount }}</b> <span>退款</span><b>¥{{ detail.refundAmount }}</b> <span>佣金</span><b>¥{{ detail.commissionAmount }}</b> <span>调整</span><b>¥{{ detail.adjustmentAmount }}</b> <span>状态</span><b>{{ detail.statusName
            }}{{ detail.paidAt ? ` · ${detail.paidAt}` : '' }}</b>
        </div>
        <h4>纳入订单</h4>
        <div v-if="!(detail.orders || []).length" class="muted">
          这一期没有完成的订单
        </div>
        <div
          v-for="item in detail.orders || []"
          :key="item.orderNo"
          class="line"
        >
          <span>{{ item.orderNo }} · {{ item.time }}</span><b>¥{{ item.amount }}</b>
        </div>
        <h4>纳入退款</h4>
        <div v-if="!(detail.refunds || []).length" class="muted">
          这一期没有要扣的退款
        </div>
        <div v-for="item in detail.refunds || []" :key="item.no" class="line">
          <span>{{ item.no }} · {{ item.orderNo }} · {{ item.timing }}</span><b>¥{{ item.amount }}</b>
        </div>
      </template>
    </Modal>
  </Page>
</template>

<style scoped>
.live {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 12px 14px;
  margin-bottom: 12px;
  border: 1px solid color-mix(in srgb, #1677ff 45%, transparent);
  border-radius: 12px;
}

.intro {
  margin-bottom: 16px;
}

.muted {
  font-size: 12px;
  color: #8c8c8c;
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.no {
  font-size: 16px;
  font-weight: 650;
}

.money {
  font-size: 28px;
  font-weight: 700;
  color: #cf1322;
}

.grid {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px 12px;
}

h4 {
  margin: 14px 0 8px;
}

.line {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid color-mix(in srgb, currentcolor 12%, transparent);
}
</style>
