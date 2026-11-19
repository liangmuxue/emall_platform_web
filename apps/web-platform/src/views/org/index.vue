<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Select,
  Table,
  Tag,
  Tree,
} from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Menu = { children?: Menu[]; id: string; label: string };
type MenuNode = { children?: MenuNode[]; key: string; title: string };
type Role = {
  dataScope: string;
  id: number;
  menuCount: string;
  menus: string[];
  name: string;
  staffCount: number;
  status: string;
  system: boolean;
};
type Staff = {
  id: number;
  login: string;
  name: string;
  phone?: string;
  role?: string;
  roleId?: number;
  status: string;
};

const route = useRoute();
const tab = computed<'roles' | 'staff'>(() =>
  route.path.includes('/staff') ? 'staff' : 'roles',
);
const menus = ref<Menu[]>([]);
const roles = ref<Role[]>([]);
const staff = ref<Staff[]>([]);
const loading = ref(false);
const saving = ref(false);
const roleOpen = ref(false);
const permOpen = ref(false);
const staffOpen = ref(false);
const fromCreate = ref(false);
const editingId = ref<null | number>(null);
const roleForm = ref({ dataScope: '全部业务线', name: '', status: '启用' });
const picked = ref<string[]>([]);
const permSystem = ref(false);
const expandedMenuKeys = ref<string[]>([]);
const staffForm = ref({
  login: '',
  name: '',
  phone: '',
  roleId: undefined as number | undefined,
  status: '启用',
});

const roleColumns: TableColumnsType<Role> = [
  { title: '岗位', dataIndex: 'name', key: 'name' },
  { title: '菜单', dataIndex: 'menuCount', key: 'menus', width: 100 },
  { title: '员工', dataIndex: 'staffCount', key: 'staff', width: 90 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 100 },
];
const staffColumns: TableColumnsType<Staff> = [
  { title: '员工', dataIndex: 'name', key: 'name' },
  { title: '登录账号', dataIndex: 'login', key: 'login', width: 160 },
  { title: '岗位', dataIndex: 'role', key: 'role', width: 160 },
  { title: '手机号', dataIndex: 'phone', key: 'phone', width: 150 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 100 },
];

const roleOptions = computed(() =>
  roles.value
    .filter((item) => item.status === '启用')
    .map((item) => ({ label: item.name, value: item.id })),
);
const selectedRoleName = computed(
  () =>
    roleOptions.value.find((item) => item.value === staffForm.value.roleId)
      ?.label || '未选岗位',
);
const enabledRoles = computed(
  () => roles.value.filter((item) => item.status === '启用').length,
);
const enabledStaff = computed(
  () => staff.value.filter((item) => item.status === '启用').length,
);

async function load() {
  loading.value = true;
  try {
    if (tab.value === 'roles') {
      const [menuTree, roleRows] = await Promise.all([
        requestClient.get<Menu[]>('/org/menus'),
        requestClient.get<Role[]>('/org/roles'),
      ]);
      menus.value = menuTree;
      roles.value = roleRows;
      return;
    }
    const [roleRows, staffRows] = await Promise.all([
      requestClient.get<Role[]>('/org/roles'),
      requestClient.get<Staff[]>('/org/staff'),
    ]);
    roles.value = roleRows;
    staff.value = staffRows;
  } finally {
    loading.value = false;
  }
}

function leaves(nodes: Menu[]): Menu[] {
  return nodes.flatMap((node) =>
    node.children?.length ? leaves(node.children) : [node],
  );
}

function toTree(nodes: Menu[]): MenuNode[] {
  return nodes.map((node) => ({
    children: node.children?.length ? toTree(node.children) : undefined,
    key: node.id,
    title: node.label,
  }));
}

const menuTreeData = computed(() => toTree(menus.value));
const leafIdList = computed(() => leaves(menus.value).map((item) => item.id));
const checkedMenuKeys = computed(() => {
  const keys = new Set(picked.value);
  const walk = (nodes: Menu[]) => {
    for (const node of nodes) {
      if (!node.children?.length) continue;
      walk(node.children);
      const ids = leaves([node]).map((item) => item.id);
      if (ids.length > 0 && ids.every((id) => keys.has(id))) keys.add(node.id);
    }
  };
  walk(menus.value);
  return [...keys];
});

function openCreateRole() {
  editingId.value = null;
  fromCreate.value = true;
  roleForm.value = { dataScope: '全部业务线', name: '', status: '启用' };
  roleOpen.value = true;
}

function openPerm(role: Role, created = false) {
  fromCreate.value = created;
  editingId.value = role.id;
  permSystem.value = role.system;
  const known = new Set(leafIdList.value);
  picked.value = role.menus.includes('*')
    ? [...known]
    : role.menus.filter((id) => known.has(id));
  expandedMenuKeys.value = menus.value.map((item) => item.id);
  roleForm.value = {
    dataScope: '全部业务线',
    name: role.name,
    status: role.status,
  };
  permOpen.value = true;
}

function onMenuCheck(
  keys: (number | string)[] | { checked: (number | string)[] },
) {
  const list = (Array.isArray(keys) ? keys : keys.checked).map(String);
  const known = new Set(leafIdList.value);
  picked.value = list.filter((id) => known.has(id));
}

function selectAllMenus() {
  picked.value = [...leafIdList.value];
}

function clearMenus() {
  picked.value = [];
}

async function saveRole() {
  if (!roleForm.value.name.trim()) {
    message.warning('请填写岗位名称');
    throw new Error('name required');
  }
  if (saving.value) throw new Error('saving');
  saving.value = true;
  try {
    const body = {
      ...roleForm.value,
      name: roleForm.value.name.trim(),
      menus: editingId.value ? undefined : ['overview'],
    };
    if (editingId.value) {
      await requestClient.put(`/org/roles/${editingId.value}`, {
        ...roleForm.value,
        name: roleForm.value.name.trim(),
        menus: picked.value.filter((id) => leafIdList.value.includes(id)),
      });
    } else {
      const created = await requestClient.post<{ id: number }>(
        '/org/roles',
        body,
      );
      editingId.value = created.id;
      message.success('岗位已保存，请继续配置菜单');
      roleOpen.value = false;
      await load();
      const createdRole = roles.value.find((item) => item.id === created.id);
      if (createdRole) openPerm(createdRole, true);
      return;
    }
    message.success('岗位权限已保存');
    permOpen.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

function openStaff(row?: Staff) {
  editingId.value = row?.id ?? null;
  staffForm.value = {
    login: row?.login ?? '',
    name: row?.name ?? '',
    phone: row?.phone ?? '',
    roleId: row?.roleId,
    status: row?.status ?? '启用',
  };
  staffOpen.value = true;
}

async function saveStaff() {
  if (!staffForm.value.name.trim() || !staffForm.value.login.trim()) {
    message.warning('请填写姓名和登录账号');
    throw new Error('staff required');
  }
  if (!staffForm.value.roleId) {
    message.warning('请选择岗位');
    throw new Error('role required');
  }
  const payload = {
    ...staffForm.value,
    login: staffForm.value.login.trim(),
    name: staffForm.value.name.trim(),
  };
  if (editingId.value) {
    await requestClient.put(`/org/staff/${editingId.value}`, payload);
    message.success('员工已保存');
  } else {
    await requestClient.post('/org/staff', payload);
    message.success('员工已新增，初始密码 123456');
  }
  staffOpen.value = false;
  await load();
}

watch(tab, load, { immediate: true });
</script>

<template>
  <Page :title="tab === 'roles' ? '岗位权限' : '平台员工'">
    <div class="head">
      <p class="lead">
        {{
          tab === 'roles'
            ? '维护平台岗位和可访问菜单。平台端不设部门。'
            : '维护平台员工。新员工初始密码是 123456，登录账号创建后不能改。'
        }}
      </p>
      <Button
        type="primary"
        @click="tab === 'roles' ? openCreateRole() : openStaff()"
      >
        {{ tab === 'roles' ? '新增岗位' : '新增员工' }}
      </Button>
    </div>

    <div v-if="tab === 'roles'" class="board">
      <div class="metric sale">
        <span>岗位</span>
        <b>{{ roles.length }}</b>
        <small>平台岗位，决定可访问菜单</small>
      </div>
      <div class="metric warn">
        <span>启用中</span>
        <b>{{ enabledRoles }}</b>
        <small>当前可以分配给员工</small>
      </div>
      <div class="metric pending">
        <span>在职员工</span>
        <b>{{ roles.reduce((sum, item) => sum + item.staffCount, 0) }}</b>
        <small>已绑定岗位的平台员工</small>
      </div>
    </div>
    <div v-else class="board">
      <div class="metric sale">
        <span>员工</span>
        <b>{{ staff.length }}</b>
        <small>平台员工账号</small>
      </div>
      <div class="metric warn">
        <span>启用中</span>
        <b>{{ enabledStaff }}</b>
        <small>当前可以登录后台</small>
      </div>
      <div class="metric pending">
        <span>可分配岗位</span>
        <b>{{ roleOptions.length }}</b>
        <small>启用中的岗位，可分配给员工</small>
      </div>
    </div>

    <div class="panel">
      <Table
        v-if="tab === 'roles'"
        :columns="roleColumns"
        :data-source="roles"
        :loading="loading"
        :pagination="false"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="who">
              <span class="avatar">{{ String(record.name).slice(0, 1) }}</span>
              <div>
                <div class="who-name">{{ record.name }}</div>
                <div v-if="record.system" class="who-sub">系统内置</div>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'menus'">
            <span class="count">{{ record.menuCount }}</span>
          </template>
          <template v-else-if="column.key === 'staff'">
            <span class="count">{{ record.staffCount }}</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <Tag :color="record.status === '启用' ? 'green' : 'default'">
              {{ record.status }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <Button size="small" type="link" @click="openPerm(record as Role)">
              配置
            </Button>
          </template>
        </template>
      </Table>
      <Table
        v-else
        :columns="staffColumns"
        :data-source="staff"
        :loading="loading"
        :pagination="false"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="who">
              <span class="avatar">{{ String(record.name).slice(0, 1) }}</span>
              <div class="who-name">{{ record.name }}</div>
            </div>
          </template>
          <template v-else-if="column.key === 'login'">
            <span class="mono">{{ record.login }}</span>
          </template>
          <template v-else-if="column.key === 'role'">
            <Tag>{{ record.role || '未分配' }}</Tag>
          </template>
          <template v-else-if="column.key === 'phone'">
            {{ record.phone || '—' }}
          </template>
          <template v-else-if="column.key === 'status'">
            <Tag :color="record.status === '启用' ? 'green' : 'default'">
              {{ record.status }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <Button
              size="small"
              type="link"
              @click="openStaff(record as Staff)"
            >
              编辑
            </Button>
          </template>
        </template>
      </Table>
    </div>

    <Modal
      v-model:open="roleOpen"
      :confirm-loading="saving"
      ok-text="保存并配置菜单"
      width="640px"
      @ok="saveRole"
    >
      <template #title>
        <div class="dialog-title">
          <span class="avatar">{{ roleForm.name.slice(0, 1) || '岗' }}</span>
          <div>
            <div class="who-name">新增岗位</div>
            <div class="who-sub">先填写基本信息，下一步勾选可访问菜单</div>
          </div>
        </div>
      </template>
      <div class="steps">
        <span class="step on"><i>1</i>填写岗位</span>
        <span class="step-line"></span>
        <span class="step"><i>2</i>配置菜单</span>
      </div>
      <Form layout="vertical">
        <Form.Item label="岗位名称" required>
          <Input
            v-model:value="roleForm.name"
            :maxlength="64"
            placeholder="例如：运营、客服、财务"
            size="large"
          />
        </Form.Item>
        <Form.Item label="状态">
          <div class="pills">
            <button
              :class="{ on: roleForm.status === '启用' }"
              type="button"
              @click="roleForm.status = '启用'"
            >
              启用
            </button>
            <button
              :class="{ off: roleForm.status === '停用' }"
              type="button"
              @click="roleForm.status = '停用'"
            >
              停用
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      v-model:open="permOpen"
      :confirm-loading="saving"
      :ok-button-props="{ disabled: permSystem }"
      ok-text="保存权限"
      width="640px"
      @ok="saveRole"
    >
      <template #title>
        <div class="dialog-title">
          <span class="avatar">{{ roleForm.name.slice(0, 1) || '岗' }}</span>
          <div>
            <div class="who-name">
              {{ fromCreate ? '配置菜单' : '配置岗位权限' }}
            </div>
            <div class="who-sub">
              {{ roleForm.name || '未命名岗位' }} ·
              {{
                permSystem
                  ? '系统内置岗位拥有全部菜单'
                  : `已选 ${picked.length} 个菜单`
              }}
            </div>
          </div>
        </div>
      </template>
      <div v-if="fromCreate" class="steps">
        <span class="step done"><i>1</i>填写岗位</span>
        <span class="step-line"></span>
        <span class="step on"><i>2</i>配置菜单</span>
      </div>
      <div class="tree-panel">
        <div class="tree-tools">
          <span>
            {{
              permSystem
                ? '系统内置岗位不可修改'
                : `已选 ${picked.length} / ${leafIdList.length}`
            }}
          </span>
          <Button
            :disabled="permSystem"
            size="small"
            type="link"
            @click="selectAllMenus"
          >
            全选
          </Button>
          <Button
            :disabled="permSystem"
            size="small"
            type="link"
            @click="clearMenus"
          >
            清空
          </Button>
        </div>
        <Tree
          v-model:expanded-keys="expandedMenuKeys"
          checkable
          :checked-keys="checkedMenuKeys"
          :disabled="permSystem"
          :tree-data="menuTreeData"
          @check="onMenuCheck"
        />
      </div>
    </Modal>

    <Modal
      v-model:open="staffOpen"
      ok-text="保存"
      width="640px"
      @ok="saveStaff"
    >
      <template #title>
        <div class="dialog-title">
          <span class="avatar">{{ staffForm.name.slice(0, 1) || '员' }}</span>
          <div>
            <div class="who-name">
              {{ editingId ? '编辑员工' : '新增员工' }}
            </div>
            <div class="who-sub">
              {{ staffForm.name || '未填写姓名' }} · {{ selectedRoleName }}
            </div>
          </div>
        </div>
      </template>
      <div v-if="editingId" class="note">登录账号创建后不能修改。</div>
      <div v-else class="note password">
        <b>123456</b>
        <span>初始密码。员工首次登录后建议自行修改。</span>
      </div>
      <Form layout="vertical">
        <div class="form-grid">
          <Form.Item label="姓名" required>
            <Input
              v-model:value="staffForm.name"
              placeholder="员工姓名"
              size="large"
            />
          </Form.Item>
          <Form.Item label="登录账号" required>
            <Input
              v-model:value="staffForm.login"
              :disabled="!!editingId"
              placeholder="字母开头，创建后不能改"
              size="large"
            />
          </Form.Item>
          <Form.Item label="岗位" required>
            <Select
              v-model:value="staffForm.roleId"
              :options="roleOptions"
              placeholder="选择岗位"
              size="large"
            />
          </Form.Item>
          <Form.Item label="手机号">
            <Input
              v-model:value="staffForm.phone"
              placeholder="选填"
              size="large"
            />
          </Form.Item>
        </div>
        <Form.Item label="状态">
          <div class="pills">
            <button
              :class="{ on: staffForm.status === '启用' }"
              type="button"
              @click="staffForm.status = '启用'"
            >
              启用
            </button>
            <button
              :class="{ off: staffForm.status === '停用' }"
              type="button"
              @click="staffForm.status = '停用'"
            >
              停用
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.lead {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #8c8c8c;
}

.board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
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

.metric.sale b {
  color: hsl(var(--primary));
}

.metric.warn b {
  color: hsl(var(--warning));
}

.metric.pending b {
  color: hsl(var(--success));
}

.panel {
  padding: 4px 8px 8px;
  border: 1px solid color-mix(in srgb, currentcolor 10%, transparent);
  border-radius: 12px;
}

.who {
  display: flex;
  gap: 10px;
  align-items: center;
}

.avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  font-weight: 650;
  color: #1677ff;
  background: color-mix(in srgb, #1677ff 16%, transparent);
  border-radius: 10px;
}

.who-name {
  font-weight: 600;
}

.who-sub {
  margin-top: 2px;
  font-size: 12px;
  color: #8c8c8c;
}

.count,
.mono {
  font-variant-numeric: tabular-nums;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.dialog-title {
  display: flex;
  gap: 12px;
  align-items: center;
}

.steps {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 18px;
}

.step {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: #8c8c8c;
}

.step i {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  font-size: 12px;
  font-style: normal;
  border: 1px solid color-mix(in srgb, currentcolor 20%, transparent);
  border-radius: 50%;
}

.step.on,
.step.done {
  font-weight: 600;
  color: #1677ff;
}

.step.on i,
.step.done i {
  color: #fff;
  background: #1677ff;
  border-color: #1677ff;
}

.step-line {
  flex: 1;
  max-width: 72px;
  height: 1px;
  background: color-mix(in srgb, currentcolor 18%, transparent);
}

.pills {
  display: flex;
  gap: 8px;
}

.pills button {
  height: 36px;
  padding: 0 18px;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentcolor 16%, transparent);
  border-radius: 999px;
}

.pills button.on {
  color: #1677ff;
  background: color-mix(in srgb, #1677ff 12%, transparent);
  border-color: #1677ff;
}

.pills button.off {
  color: #ff4d4f;
  background: color-mix(in srgb, #ff4d4f 12%, transparent);
  border-color: #ff4d4f;
}

.note {
  margin-bottom: 16px;
  font-size: 13px;
  color: #8c8c8c;
}

.note.password {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 22%),
    hsl(var(--card)) 62%
  );
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.note.password b {
  font-size: 20px;
  font-weight: 700;
  color: hsl(var(--primary));
  letter-spacing: 0.04em;
}

.tree-panel {
  max-height: min(480px, calc(100vh - 320px));
  padding: 8px 8px 12px 12px;
  overflow: auto;
  background: color-mix(in srgb, currentcolor 3%, transparent);
  border: 1px solid color-mix(in srgb, currentcolor 12%, transparent);
  border-radius: 12px;
}

.tree-tools {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-bottom: 4px;
}

.tree-tools span {
  margin-right: auto;
  font-size: 12px;
  color: #8c8c8c;
}

.tree-panel :deep(.ant-tree) {
  background: transparent;
}

.tree-panel :deep(.ant-tree-treenode) {
  align-items: center;
  padding: 3px 0;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}
</style>
