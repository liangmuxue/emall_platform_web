<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Form,
  FormItem,
  Image,
  Input,
  message,
  Modal,
  Radio,
  Select,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Product = {
  auditRemark?: string;
  categoryName: string;
  coverUrl?: string;
  id: number;
  createdAt?: string;
  marketPrice?: null | number;
  memberPrice?: null | number;
  price?: null | number;
  priceFrom?: boolean;
  productName: string;
  salesStatus: string;
  shopName: string;
  skuCount?: number;
  specSummary?: string;
  spuNo?: string;
  statusName: string;
  stock?: number;
};

type ProductDetail = Product & {
  detail?: string;
  fakeSold?: number;
  imageUrls?: string[];
  services?: string;
  skus?: Sku[];
  soldCount?: number;
  specImages?: boolean;
};

type Sku = {
  imageUrl?: null | string;
  key: string;
  marketPrice?: null | number;
  memberPrice?: null | number;
  parentKey?: string;
  salePrice?: null | number;
  skuName: string;
  stock?: null | number;
  unitName?: null | string;
};

type SpecRow = {
  depth: number;
  group: boolean;
  imageUrl?: null | string;
  key: string;
  lead: boolean;
  marketPrice?: null | number;
  memberPrice?: null | number;
  salePrice?: null | number;
  skuName: string;
  stock?: null | number;
  unitName?: null | string;
};

const rows = ref<Product[]>([]);
const loading = ref(false);
const keyword = ref('');
const filter = ref('pending');
const expanded = ref<number[]>([]);
const specs = ref<Record<number, SpecRow[]>>({});
const specLoading = ref<Record<number, boolean>>({});
const open = ref(false);
const saving = ref(false);
const detailLoading = ref(false);
const current = ref<null | Product>(null);
const detail = ref<null | ProductDetail>(null);
const form = reactive({ remark: '', result: 'ON_SALE' });
const columns: TableColumnsType = [
  { title: '商品信息', dataIndex: 'productName', key: 'product' },
  { title: '店铺', dataIndex: 'shopName', key: 'shopName', width: 150 },
  { title: '类目', dataIndex: 'categoryName', key: 'categoryName', width: 140 },
  { title: '售价', key: 'price', width: 110 },
  { title: '总库存', dataIndex: 'stock', key: 'stock', width: 100 },
  { title: '状态', dataIndex: 'statusName', key: 'status', width: 160 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' },
];

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  OFF_SHELF: 'warning',
  ON_SALE: 'success',
  PENDING: 'processing',
  REJECTED: 'error',
};

const counts = computed(() => ({
  on: rows.value.filter((item) => item.salesStatus === 'ON_SALE').length,
  pending: rows.value.filter((item) => item.salesStatus === 'PENDING').length,
  rejected: rows.value.filter((item) => item.salesStatus === 'REJECTED').length,
}));

const filtered = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return rows.value.filter((item) => {
    const text = [
      item.productName,
      item.shopName,
      item.categoryName,
      item.spuNo,
      item.specSummary,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (query && !text.includes(query)) return false;
    if (filter.value === 'pending') return item.salesStatus === 'PENDING';
    if (filter.value === 'on') return item.salesStatus === 'ON_SALE';
    if (filter.value === 'rejected') return item.salesStatus === 'REJECTED';
    if (filter.value === 'off') return item.salesStatus === 'OFF_SHELF';
    if (filter.value === 'draft') return item.salesStatus === 'DRAFT';
    return true;
  });
});

function money(value?: null | number) {
  if (value === undefined || value === null) return '—';
  return `¥${Number(value).toFixed(2)}`;
}

function specRows(list: Sku[]) {
  const childrenOf = (parent: string) =>
    list.filter((item) => (item.parentKey || '') === parent);
  const built: SpecRow[] = [];
  const walk = (parent: string, depth: number) => {
    childrenOf(parent).forEach((item) => {
      const group = childrenOf(item.key).length > 0;
      built.push({
        depth,
        group,
        imageUrl: item.imageUrl,
        key: item.key,
        lead: false,
        marketPrice: item.marketPrice,
        memberPrice: item.memberPrice,
        salePrice: item.salePrice,
        skuName: item.skuName,
        stock: item.stock,
        unitName: item.unitName,
      });
      walk(item.key, depth + 1);
    });
  };
  walk('', 0);
  const prices = built
    .filter((item) => !item.group && Number(item.salePrice) > 0)
    .map((item) => Number(item.salePrice));
  const lowest = prices.length > 0 ? Math.min(...prices) : Number.NaN;
  const lead = built.find(
    (item) => !item.group && Number(item.salePrice) === lowest,
  );
  if (lead && prices.length > 1) lead.lead = true;
  return built;
}

function isOpen(id: number) {
  return expanded.value.includes(id);
}

async function loadSpecs(id: number) {
  if (specs.value[id] || specLoading.value[id]) return;
  specLoading.value = { ...specLoading.value, [id]: true };
  try {
    const product = await requestClient.get<{ skus?: Sku[] }>(
      `/products/${id}`,
    );
    specs.value = { ...specs.value, [id]: specRows(product.skus || []) };
  } finally {
    specLoading.value = { ...specLoading.value, [id]: false };
  }
}

function toggle(record: Product | Record<string, any>) {
  if (isOpen(record.id)) {
    expanded.value = expanded.value.filter((id) => id !== record.id);
    return;
  }
  expanded.value = [...expanded.value, record.id];
  void loadSpecs(record.id);
}

function statusTone(item: Product | Record<string, any>) {
  if (item.salesStatus === 'ON_SALE' && Number(item.stock) === 0)
    return 'default';
  return statusColor[item.salesStatus] || 'default';
}

function statusText(item: Product | Record<string, any>) {
  if (item.salesStatus === 'ON_SALE' && Number(item.stock) === 0)
    return '已售罄';
  return item.statusName;
}

async function load() {
  loading.value = true;
  try {
    rows.value = await requestClient.get<Product[]>('/products', {
      params: { status: 'ALL' },
    });
  } finally {
    loading.value = false;
  }
}

const sheetSpecs = computed(() => specRows(detail.value?.skus || []));
const sheetImages = computed(
  () => detail.value?.imageUrls?.filter(Boolean) || [],
);

function openAudit(record: Product | Record<string, any>) {
  const item = record as Product;
  current.value = item;
  detail.value = null;
  form.result = item.salesStatus === 'ON_SALE' ? 'OFF_SHELF' : 'ON_SALE';
  form.remark = '';
  open.value = true;
  detailLoading.value = true;
  requestClient
    .get<ProductDetail>(`/products/${item.id}`)
    .then((product) => {
      detail.value = product;
    })
    .finally(() => {
      detailLoading.value = false;
    });
}

async function submit() {
  if (!current.value) return;
  if (
    (form.result === 'REJECTED' || form.result === 'OFF_SHELF') &&
    !form.remark.trim()
  ) {
    message.warning('驳回或下架时请填写原因');
    return;
  }
  saving.value = true;
  try {
    await requestClient.post(`/products/${current.value.id}/audit`, {
      remark: form.remark.trim(),
      result: form.result,
    });
    message.success('已处理');
    open.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page
    description="点审核可核对图片、规格价格、图文详情和服务承诺，再决定通过、驳回或下架。"
    title="商品审核"
  >
    <div class="board">
      <button
        class="metric pending"
        :class="{ on: filter === 'pending' }"
        type="button"
        @click="filter = 'pending'"
      >
        <span>待审核</span>
        <b>{{ counts.pending }}</b>
        <small>商家已提交，等待处理</small>
      </button>
      <button
        class="metric sale"
        :class="{ on: filter === 'on' }"
        type="button"
        @click="filter = 'on'"
      >
        <span>已上架</span>
        <b>{{ counts.on }}</b>
        <small>通过后顾客可以在分类里看到</small>
      </button>
      <button
        class="metric warn"
        :class="{ on: filter === 'rejected' }"
        type="button"
        @click="filter = 'rejected'"
      >
        <span>已驳回</span>
        <b>{{ counts.rejected }}</b>
        <small>商家修改后可以再次提交</small>
      </button>
      <Card class="panel">
        <div class="toolbar">
          <Input
            v-model:value="keyword"
            allow-clear
            class="search"
            placeholder="搜索商品、店铺、类目或货号"
          />
          <Radio.Group v-model:value="filter" button-style="solid">
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="pending">待审核</Radio.Button>
            <Radio.Button value="on">已上架</Radio.Button>
            <Radio.Button value="rejected">已驳回</Radio.Button>
            <Radio.Button value="off">已下架</Radio.Button>
            <Radio.Button value="draft">草稿</Radio.Button>
          </Radio.Group>
          <Button class="refresh" @click="load">刷新</Button>
        </div>
        <Table
          class="list"
          :columns="columns"
          :data-source="filtered"
          :expanded-row-keys="expanded"
          :loading="loading"
          :pagination="{
            pageSize: 10,
            showTotal: (total: number) => `共 ${total} 个商品`,
          }"
          :scroll="{ x: 1120 }"
          :show-expand-column="false"
          row-key="id"
        >
          <template #expandedRowRender="{ record }">
            <div class="drawer">
              <div class="drawer-head">
                <b>规格价格</b>
                <span>分组规格不单独标价</span>
              </div>
              <p v-if="specLoading[record.id]" class="drawer-wait">
                正在读取规格…
              </p>
              <p v-else-if="!specs[record.id]" class="drawer-wait">
                规格没有读取到
              </p>
              <p v-else-if="!specs[record.id]?.length" class="drawer-wait">
                还没有规格
              </p>
              <div v-else class="spec-list">
                <template v-for="row in specs[record.id]" :key="row.key">
                  <div
                    v-if="row.group"
                    class="group-line"
                    :style="{ marginLeft: `${row.depth * 22}px` }"
                  >
                    <i></i>
                    <b>{{ row.skuName }}</b>
                    <em>分组</em>
                    <span>价格由下级填写</span>
                  </div>
                  <article
                    v-else
                    class="leaf"
                    :class="{ lead: row.lead }"
                    :style="{ marginLeft: `${row.depth * 22}px` }"
                  >
                    <div class="leaf-name">
                      <i :class="row.depth ? 'branch' : 'root'"></i>
                      <b>{{ row.skuName }}</b>
                      <em>{{ row.unitName || '份' }}</em>
                      <span v-if="row.lead" class="badge">最低</span>
                    </div>
                    <dl class="figures">
                      <div>
                        <dt>售价</dt>
                        <dd>{{ money(row.salePrice) }}</dd>
                      </div>
                      <div>
                        <dt>划线价</dt>
                        <dd :class="{ strike: row.marketPrice }">
                          {{ money(row.marketPrice) }}
                        </dd>
                      </div>
                      <div>
                        <dt>会员价</dt>
                        <dd class="member">{{ money(row.memberPrice) }}</dd>
                      </div>
                      <div>
                        <dt>库存</dt>
                        <dd>
                          {{
                            row.stock === undefined || row.stock === null
                              ? '—'
                              : row.stock
                          }}
                        </dd>
                      </div>
                    </dl>
                  </article>
                </template>
              </div>
            </div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'product'">
              <div class="product">
                <div class="cover">
                  <img v-if="record.coverUrl" :src="record.coverUrl" alt="" />
                  <span v-else>{{ record.productName.slice(0, 1) }}</span>
                </div>
                <div class="copy">
                  <b>{{ record.productName }}</b>
                  <small>{{ record.spuNo || '未填货号' }} ·
                    {{ record.skuCount || 0 }} 个规格</small>
                  <small v-if="record.specSummary" class="specs">{{
                    record.specSummary
                  }}</small>
                  <button
                    class="peek"
                    :class="{ open: isOpen(record.id) }"
                    type="button"
                    @click="toggle(record)"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6 3.5 10.5 8 6 12.5" />
                    </svg>
                    {{ isOpen(record.id) ? '收起规格价格' : '查看规格价格' }}
                  </button>
                </div>
              </div>
            </template>
            <template v-else-if="column.key === 'price'">
              <span class="stock">{{
                record.price === undefined || record.price === null
                  ? '—'
                  : `${record.priceFrom ? '起 ' : ''}${money(record.price)}`
              }}</span>
            </template>
            <template v-else-if="column.key === 'stock'">
              <span class="stock">{{ record.stock ?? 0 }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <div class="status">
                <Tag :color="statusTone(record)">{{ statusText(record) }}</Tag>
                <small v-if="record.auditRemark">{{
                  record.auditRemark
                }}</small>
              </div>
            </template>
            <template v-else-if="column.key === 'action'">
              <Button
                v-if="
                  record.salesStatus === 'PENDING' ||
                  record.salesStatus === 'ON_SALE'
                "
                size="small"
                type="link"
                @click="openAudit(record)"
              >
                {{ record.salesStatus === 'ON_SALE' ? '下架' : '审核' }}
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
      :open="open"
      :title="null"
      width="920px"
      wrap-class-name="product-audit-modal"
      @cancel="open = false"
    >
      <div v-if="current" class="sheet">
        <header class="hero">
          <div class="hero-copy">
            <span>{{
              current.salesStatus === 'PENDING'
                ? '审核商品'
                : current.salesStatus === 'ON_SALE'
                  ? '下架商品'
                  : '商品详情'
            }}</span>
            <b>{{ detail?.productName || current.productName }}</b>
            <p>
              {{ current.shopName }} · {{ current.categoryName }} ·
              {{ current.spuNo || '未填货号' }}
            </p>
          </div>
          <em>{{ statusText(detail || current) }}</em>
        </header>
        <Spin :spinning="detailLoading">
          <div class="sheet-body">
            <section class="block">
              <header>
                <b>商品资料</b>
                <span>{{
                  (current.createdAt || '').slice(0, 16) || '提交时间未记录'
                }}</span>
              </header>
              <div class="block-body">
                <Image.PreviewGroup v-if="sheetImages.length">
                  <div class="gallery">
                    <Image v-for="url in sheetImages" :key="url" :src="url" />
                  </div>
                </Image.PreviewGroup>
                <p v-else class="empty">商家还没有上传商品图片</p>
                <div class="facts">
                  <div>
                    <span>最低售价</span>
                    <b>{{
                      current.price === undefined || current.price === null
                        ? '—'
                        : `${current.priceFrom ? '起 ' : ''}${money(current.price)}`
                    }}</b>
                  </div>
                  <div>
                    <span>划线价</span>
                    <b>{{ money(current.marketPrice) }}</b>
                  </div>
                  <div>
                    <span>会员价</span>
                    <b>{{ money(current.memberPrice) }}</b>
                  </div>
                  <div>
                    <span>总库存</span>
                    <b>{{ current.stock ?? 0 }}</b>
                  </div>
                  <div>
                    <span>真实已售</span>
                    <b>{{ detail?.soldCount ?? 0 }}</b>
                  </div>
                  <div>
                    <span>基础已售</span>
                    <b>{{ detail?.fakeSold ?? 0 }}</b>
                  </div>
                </div>
              </div>
            </section>
            <section class="block">
              <header>
                <b>规格价格</b>
                <span>分组规格不单独标价，最低价会标出来</span>
              </header>
              <div class="block-body">
                <p v-if="!sheetSpecs.length" class="empty">还没有规格</p>
                <template v-for="row in sheetSpecs" :key="row.key">
                  <div
                    v-if="row.group"
                    class="group-line"
                    :style="{ marginLeft: `${row.depth * 18}px` }"
                  >
                    <i></i>
                    <b>{{ row.skuName }}</b>
                    <em>分组</em>
                  </div>
                  <article
                    v-else
                    class="leaf"
                    :class="{ lead: row.lead }"
                    :style="{ marginLeft: `${row.depth * 18}px` }"
                  >
                    <img
                      v-if="row.imageUrl"
                      class="sku-image"
                      :src="row.imageUrl"
                      alt=""
                    />
                    <div class="leaf-name">
                      <b>{{ row.skuName }}</b>
                      <em>{{ row.unitName || '份' }}</em>
                      <span v-if="row.lead" class="badge">最低</span>
                    </div>
                    <dl class="figures">
                      <div>
                        <dt>售价</dt>
                        <dd>{{ money(row.salePrice) }}</dd>
                      </div>
                      <div>
                        <dt>划线价</dt>
                        <dd :class="{ strike: row.marketPrice }">
                          {{ money(row.marketPrice) }}
                        </dd>
                      </div>
                      <div>
                        <dt>会员价</dt>
                        <dd class="member">{{ money(row.memberPrice) }}</dd>
                      </div>
                      <div>
                        <dt>库存</dt>
                        <dd>
                          {{
                            row.stock === undefined || row.stock === null
                              ? '—'
                              : row.stock
                          }}
                        </dd>
                      </div>
                    </dl>
                  </article>
                </template>
              </div>
            </section>
            <section class="block">
              <header>
                <b>图文详情</b>
                <span>顾客在商品介绍里看到的内容</span>
              </header>
              <div class="block-body">
                <div
                  v-if="detail?.detail"
                  class="rich"
                  v-html="detail.detail"
                ></div>
                <p v-else class="empty">没有填写商品介绍</p>
              </div>
            </section>
            <section class="block">
              <header>
                <b>服务承诺</b>
                <span>所有规格共用</span>
              </header>
              <div class="block-body">
                <div
                  v-if="detail?.services"
                  class="rich"
                  v-html="detail.services"
                ></div>
                <p v-else class="empty">没有填写服务承诺</p>
              </div>
            </section>
            <section
              v-if="detail?.auditRemark || current.auditRemark"
              class="block"
            >
              <header>
                <b>上次审核说明</b>
                <span>商家再次提交前会看到这段话</span>
              </header>
              <div class="block-body">
                <p class="note">
                  {{ detail?.auditRemark || current.auditRemark }}
                </p>
              </div>
            </section>
            <section
              v-if="
                current.salesStatus === 'PENDING' ||
                current.salesStatus === 'ON_SALE'
              "
              class="block"
            >
              <header>
                <b>{{
                  current.salesStatus === 'ON_SALE' ? '下架原因' : '审核意见'
                }}</b>
                <span>{{
                  current.salesStatus === 'PENDING'
                    ? '驳回时必填'
                    : '下架时必填'
                }}</span>
              </header>
              <div class="block-body">
                <Form layout="vertical">
                  <FormItem
                    v-if="current.salesStatus === 'PENDING'"
                    label="结果"
                  >
                    <Select
                      v-model:value="form.result"
                      :options="[
                        { label: '通过并上架', value: 'ON_SALE' },
                        { label: '驳回', value: 'REJECTED' },
                      ]"
                    />
                  </FormItem>
                  <FormItem
                    :label="current.salesStatus === 'ON_SALE' ? '原因' : '说明'"
                  >
                    <Input.TextArea
                      v-model:value="form.remark"
                      :maxlength="200"
                      :rows="3"
                      placeholder="通过可以留空。驳回或下架请写明原因，商家会看到这段说明。"
                      show-count
                    />
                  </FormItem>
                </Form>
              </div>
            </section>
          </div>
        </Spin>
        <footer class="sheet-foot">
          <p>
            {{
              current.salesStatus === 'PENDING'
                ? '通过后顾客可以在分类里看到。驳回后商家可以修改并重新提交。'
                : current.salesStatus === 'ON_SALE'
                  ? '下架后顾客不能再购买这件商品。'
                  : '这里只核对商品内容，状态不会改变。'
            }}
          </p>
          <div>
            <Button @click="open = false">
              {{
                current.salesStatus === 'PENDING' ||
                current.salesStatus === 'ON_SALE'
                  ? '取消'
                  : '关闭'
              }}
            </Button>
            <Button
              v-if="
                current.salesStatus === 'PENDING' ||
                current.salesStatus === 'ON_SALE'
              "
              :danger="form.result !== 'ON_SALE'"
              :loading="saving"
              type="primary"
              @click="submit"
            >
              {{
                current.salesStatus === 'ON_SALE'
                  ? '确认下架'
                  : form.result === 'REJECTED'
                    ? '驳回'
                    : '审核通过'
              }}
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

.metric.pending::before {
  background: linear-gradient(
    145deg,
    hsl(var(--success) / 24%),
    hsl(var(--card)) 58%
  );
}

.metric.pending::after {
  background: radial-gradient(
    circle,
    hsl(var(--success) / 38%),
    transparent 68%
  );
}

.metric b {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
}

.metric span {
  font-size: 13px;
  font-weight: 650;
  color: hsl(var(--foreground));
}

.metric small {
  max-width: 18em;
  font-size: 12px;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
}

.metric.sale b {
  color: hsl(var(--primary));
}

.metric.sale.on {
  border-color: hsl(var(--primary) / 70%);
  box-shadow: 0 0 0 3px hsl(var(--primary) / 16%);
}

.metric.warn b {
  color: hsl(var(--warning));
}

.metric.warn.on {
  border-color: hsl(var(--warning) / 70%);
  box-shadow: 0 0 0 3px hsl(var(--warning) / 16%);
}

.metric.pending b {
  color: hsl(var(--success));
}

.metric.pending.on {
  border-color: hsl(var(--success) / 65%);
  box-shadow: 0 0 0 3px hsl(var(--success) / 16%);
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

.product {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 240px;
}

.cover {
  display: grid;
  flex: none;
  place-items: center;
  width: 56px;
  height: 56px;
  overflow: hidden;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--accent));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.copy .specs {
  max-width: 280px;
}

.peek {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  width: fit-content;
  padding: 0;
  font-size: 12px;
  color: hsl(var(--primary));
  cursor: pointer;
  background: transparent;
  border: 0;
}

.peek svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.15s ease;
}

.peek.open svg {
  transform: rotate(90deg);
}

.stock {
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

.status small {
  font-size: 12px;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

.list :deep(.ant-table-cell) {
  vertical-align: middle;
}

.list :deep(.ant-table) {
  background: transparent;
}

.list :deep(.ant-table-thead > tr > th) {
  font-weight: 650;
}

.list :deep(.ant-table-expanded-row > .ant-table-cell) {
  padding: 2px 16px 16px !important;
  background: transparent !important;
}

.drawer {
  overflow: hidden;
  background: linear-gradient(
    180deg,
    hsl(var(--primary) / 12%),
    hsl(var(--card)) 64px
  );
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.drawer-head {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
  padding: 14px 16px 8px;
}

.drawer-head b {
  font-size: 13px;
}

.drawer-head span,
.drawer-wait {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.drawer-wait {
  padding: 8px 16px 16px;
  margin: 0;
}

.spec-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 12px 12px;
}

.group-line {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 4px 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.group-line i {
  flex: none;
  width: 8px;
  height: 8px;
  background: hsl(var(--primary));
  border-radius: 8px;
}

.group-line b {
  font-weight: 650;
  color: hsl(var(--foreground));
}

.group-line em {
  padding: 0 7px;
  font-size: 12px;
  font-style: normal;
  line-height: 20px;
  background: hsl(var(--accent));
  border-radius: 999px;
}

.leaf {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.leaf.lead {
  background: linear-gradient(
    90deg,
    hsl(var(--primary) / 14%),
    hsl(var(--card)) 46%
  );
  border-color: hsl(var(--primary) / 50%);
}

.leaf-name {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.leaf-name b {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 650;
  white-space: nowrap;
}

.leaf-name em {
  font-size: 12px;
  font-style: normal;
  color: hsl(var(--muted-foreground));
}

.leaf-name .root,
.leaf-name .branch {
  flex: none;
  width: 8px;
  height: 8px;
  background: hsl(var(--primary));
  border-radius: 8px;
}

.leaf-name .branch {
  background: transparent;
  box-shadow: inset 0 0 0 2px hsl(var(--primary));
}

.badge {
  padding: 0 7px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-radius: 999px;
}

.figures {
  display: grid;
  grid-template-columns: repeat(4, 84px);
  gap: 10px;
  margin: 0;
}

.figures div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.figures dt {
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.figures dd {
  margin: 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.figures .strike {
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  text-decoration: line-through;
}

.figures .member {
  color: hsl(var(--primary));
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
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 24%),
    hsl(var(--card)) 68%
  );
}

.hero-copy {
  min-width: 0;
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
  max-height: min(68vh, 680px);
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

.block > header {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
  padding: 12px 14px 8px;
}

.block > header span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.block-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 14px 14px;
}

.gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.gallery :deep(.ant-image) {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.gallery :deep(.ant-image-img) {
  width: 84px;
  height: 84px;
  object-fit: cover;
}

.facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
  font-size: 14px;
  white-space: nowrap;
}

.sku-image {
  flex: none;
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 8px;
}

.empty,
.note {
  margin: 0;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.note {
  color: hsl(var(--foreground));
}

.rich {
  line-height: 1.7;
  color: hsl(var(--foreground));
}

.rich :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}

.rich :deep(p) {
  margin: 0 0 8px;
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
  flex: none;
  gap: 8px;
}
</style>

<style>
.product-audit-modal .ant-modal-content {
  padding: 0;
  overflow: hidden;
  border-radius: 18px;
}

.product-audit-modal .ant-modal-header {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  padding: 0;
  margin: 0;
  background: transparent;
  border: 0;
}

.product-audit-modal .ant-modal-title {
  display: none;
}

.product-audit-modal .ant-modal-body {
  padding: 0;
}

.product-audit-modal .ant-modal-close {
  color: hsl(var(--foreground));
}
</style>
