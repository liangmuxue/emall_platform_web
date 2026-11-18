<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Checkbox,
  Input,
  message,
  Modal,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Menu = { children?: Menu[]; id: string; label: string };
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

const tab = ref<'roles' | 'staff'>('roles');
const menus = ref<Menu[]>([]);
const roles = ref<Role[]>([]);
const staff = ref<Staff[]>([]);
const scopes = ['全部业务线', '仅线上商城', '仅会有便利', '仅鲜生活'];
const roleOpen = ref(false);
const permOpen = ref(false);
const staffOpen = ref(false);
const editingId = ref<null | number>(null);
const roleForm = ref({ dataScope: '全部业务线', name: '', status: '启用' });
const picked = ref<string[]>([]);
const permScope = ref('全部业务线');
const permSystem = ref(false);
const staffForm = ref({
  login: '',
  name: '',
  phone: '',
  roleId: undefined as number | undefined,
  status: '启用',
});

const roleColumns: TableColumnsType<Role> = [
  { title: '岗位', dataIndex: 'name', key: 'name' },
  { title: '数据范围', dataIndex: 'dataScope', key: 'scope' },
  { title: '菜单', dataIndex: 'menuCount', key: 'menus', width: 90 },
  { title: '员工', dataIndex: 'staffCount', key: 'staff', width: 80 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 90 },
];
const staffColumns: TableColumnsType<Staff> = [
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '登录账号', dataIndex: 'login', key: 'login' },
  { title: '岗位', dataIndex: 'role', key: 'role' },
  { title: '手机号', dataIndex: 'phone', key: 'phone' },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 90 },
];

const roleOptions = computed(() =>
  roles.value
    .filter((item) => item.status === '启用')
    .map((item) => ({ label: item.name, value: item.id })),
);

async function load() {
  const [menuTree, roleRows, staffRows] = await Promise.all([
    requestClient.get<Menu[]>('/org/menus'),
    requestClient.get<Role[]>('/org/roles'),
    requestClient.get<Staff[]>('/org/staff'),
  ]);
  menus.value = menuTree;
  roles.value = roleRows;
  staff.value = staffRows;
}

function leaves(nodes: Menu[]): Menu[] {
  return nodes.flatMap((node) =>
    node.children?.length ? leaves(node.children) : [node],
  );
}

function openCreateRole() {
  editingId.value = null;
  roleForm.value = { dataScope: '全部业务线', name: '', status: '启用' };
  roleOpen.value = true;
}

function openPerm(role: Role) {
  editingId.value = role.id;
  permSystem.value = role.system;
  permScope.value = role.dataScope;
  picked.value = role.menus.includes('*')
    ? leaves(menus.value).map((item) => item.id)
    : [...role.menus];
  roleForm.value = {
    dataScope: role.dataScope,
    name: role.name,
    status: role.status,
  };
  permOpen.value = true;
}

function toggle(id: string, checked: boolean) {
  picked.value = checked
    ? [...picked.value, id]
    : picked.value.filter((item) => item !== id);
}

async function saveRole() {
  const body = {
    ...roleForm.value,
    menus: editingId.value ? undefined : ['overview'],
  };
  if (editingId.value) {
    await requestClient.put(`/org/roles/${editingId.value}`, {
      ...roleForm.value,
      menus: picked.value,
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
    if (createdRole) openPerm(createdRole);
    return;
  }
  message.success('岗位权限已保存');
  permOpen.value = false;
  await load();
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
  const payload = { ...staffForm.value };
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

onMounted(load);
</script>

<template>
  <Page title="平台组织">
    <p class="muted">
      维护岗位权限和平台员工。平台端不设部门。新员工初始密码是
      123456，登录账号创建后不能改。
    </p>
    <div class="toolbar">
      <button
        :class="{ on: tab === 'roles' }"
        type="button"
        @click="tab = 'roles'"
      >
        岗位权限
      </button>
      <button
        :class="{ on: tab === 'staff' }"
        type="button"
        @click="tab = 'staff'"
      >
        平台员工
      </button>
      <Button
        type="primary"
        @click="tab === 'roles' ? openCreateRole() : openStaff()"
      >
        {{ tab === 'roles' ? '新增岗位' : '新增员工' }}
      </Button>
    </div>
    <Table
      v-if="tab === 'roles'"
      :columns="roleColumns"
      :data-source="roles"
      :pagination="false"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <Tag :color="record.status === '启用' ? 'green' : 'default'">
            {{ record.status }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <Button size="small" type="link" @click="openPerm(record)">
            配置
          </Button>
        </template>
      </template>
    </Table>
    <Table
      v-else
      :columns="staffColumns"
      :data-source="staff"
      :pagination="false"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <Tag :color="record.status === '启用' ? 'green' : 'default'">
            {{ record.status }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <Button size="small" type="link" @click="openStaff(record)">
            编辑
          </Button>
        </template>
      </template>
    </Table>

    <Modal v-model:open="roleOpen" title="新增岗位" @ok="saveRole">
      <Input v-model:value="roleForm.name" placeholder="岗位名称" />
      <Select
        v-model:value="roleForm.dataScope"
        :options="scopes.map((item) => ({ label: item, value: item }))"
        class="field"
      />
      <Select
        v-model:value="roleForm.status"
        :options="[
          { label: '启用', value: '启用' },
          { label: '停用', value: '停用' },
        ]"
        class="field"
      />
    </Modal>
    <Modal
      v-model:open="permOpen"
      :ok-button-props="{ disabled: permSystem }"
      title="配置岗位权限"
      width="720px"
      @ok="saveRole"
    >
      <p class="muted">
        {{
          permSystem
            ? '系统内置岗位拥有全部平台菜单，不可修改。'
            : '勾选该岗位可访问的平台菜单，并设置数据范围。'
        }}
      </p>
      <Select
        v-model:value="permScope"
        :disabled="permSystem"
        :options="scopes.map((item) => ({ label: item, value: item }))"
        class="field"
        @change="roleForm.dataScope = permScope"
      />
      <div v-for="group in menus" :key="group.id" class="group">
        <b>{{ group.label }}</b>
        <div class="checks">
          <Checkbox
            v-for="item in group.children || [group]"
            :key="item.id"
            :checked="picked.includes(item.id)"
            :disabled="permSystem"
            @change="toggle(item.id, $event.target.checked)"
          >
            {{ item.label }}
          </Checkbox>
        </div>
      </div>
    </Modal>
    <Modal
      v-model:open="staffOpen"
      :title="editingId ? '编辑员工' : '新增员工'"
      @ok="saveStaff"
    >
      <Input v-model:value="staffForm.name" placeholder="姓名" />
      <Input
        v-model:value="staffForm.login"
        :disabled="!!editingId"
        class="field"
        placeholder="登录账号，字母开头"
      />
      <Select
        v-model:value="staffForm.roleId"
        :options="roleOptions"
        class="field"
        placeholder="岗位"
      />
      <Input
        v-model:value="staffForm.phone"
        class="field"
        placeholder="手机号"
      />
      <Select
        v-model:value="staffForm.status"
        :options="[
          { label: '启用', value: '启用' },
          { label: '停用', value: '停用' },
        ]"
        class="field"
      />
    </Modal>
  </Page>
</template>

<style scoped>
.muted {
  font-size: 12px;
  color: #8c8c8c;
}

.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 12px 0 16px;
}

.toolbar button {
  height: 32px;
  padding: 0 14px;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentcolor 18%, transparent);
  border-radius: 999px;
}

.toolbar button.on {
  color: #1677ff;
  border-color: #1677ff;
}

.field {
  width: 100%;
  margin-top: 12px;
}

.group {
  margin-top: 14px;
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 8px;
}
</style>
