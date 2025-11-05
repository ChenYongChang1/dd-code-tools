const { transformCode } = require("../dist/plugins.cjs");

/**
 * Jest tests for Vue transform compatibility
 * - v-model → :model-value when expression transforms
 * - @update:model-value handler injection
 * - v-for `(item, index) of ProductDetail?.specList` RHS optional-chain + || []
 * - Preserve PascalCase tag names
 */

describe("Vue transform compatibility", () => {
  test("赋值语句", () => {
    const input = `a[b].c.f = f.g`;
    const out = transformCode(input, "js");


    // update handler remains and contains injected assignment to the v-model target
    expect(out).toContain('a?.[b]?.c && (a[b].c.f = f?.g)');
  });
  test("v-model只有 没有@update:model-value", () => {
    const input = `
      <template>
        <view>
          <input v-model="AAAAA.name" />
        </view>
      </template>
    `;
    const out = transformCode(input, "vue");


    // update handler remains and contains injected assignment to the v-model target
    expect(out).toMatch(/\$event\s+=>(\S|\s)+?AAAAA.name\s*=\s*\$event/);
  });
  test("v-model 含有@update 和里面是一个方法", () => {
    const input = `
      <template>
        <view>
          <input v-model="AAAAA.name" @update:model-value="ddd" />
        </view>
      </template>
    `;
    const out = transformCode(input, "vue");


    // update handler remains and contains injected assignment to the v-model target
    expect(out).toMatch(
      /\$event\s+=>(\S|\s)+?AAAAA.name\s*=\s*\$event(\S|\s)+?ddd\(\$event\)/
    );
  });
  test("v-model 含有@update 和里面是一个方法已经执行", () => {
    const input = `
      <template>
        <view>
          <input v-model="AAAAA.name" @update:model-value="(eee) => ddd(eee, index)" />
        </view>
      </template>
    `;
    const out = transformCode(input, "vue");
    // console.log(out);


    // update handler remains and contains injected assignment to the v-model target
    expect(out).toMatch(
      /eee\s+=>(\S|\s)+?AAAAA.name\s*=\s*eee(\S|\s)+?ddd\(eee, index\)/
    );
  });

  test("v-model rewrites to :model-value and injects update assignment", () => {
    const input = `
      <template>
        <view>
          <input v-model="form?.name" @update:model-value="(v)=> form.name = v" />
        </view>
      </template>
    `;
    const out = transformCode(input, "vue");

    // v-model → :model-value
    expect(out).toContain(':model-value="form?.name"');
    expect(out).not.toContain('v-model="form?.name"');

    // update handler remains and contains injected assignment to the v-model target
    expect(out).toContain("@update:model-value");
    // expect(out).toMatch(/form\?\.name\s*=\s*\w+/);
  });

  test("v-model 含有事件是@update:modelValue", () => {
    const input = `
      <template>
        <view>
          <input v-model="AAAAA.name" @update:modelValue="(v)=> AAAAA.fff = v" />
        </view>
      </template>
    `;
    const out = transformCode(input, "vue");
    console.log(out);


    // update handler remains and contains injected assignment to the v-model target
    expect(out).toMatch(/v\s+=>(\S|\s)+?AAAAA.fff\s*=\s*v/);
    expect(out).not.toMatch(/@update:model-value/);
  });

  test("v-for of with optional chain gets || [] fallback", () => {
    const input = `
      <template>
        <view v-for="(item, index) of ProductDetail.specList" :key="item.id">{{ item.name }}</view>
      </template>
    `;
    const out = transformCode(input, "vue");


    expect(out).toMatch(
      /\(item, index\)\s+of\s+\(ProductDetail\?\.specList\) \|\| \[\]/
    );
    expect(out).toContain(':key="item?.id"');
  });

  test("uni的 条件编译- script标签下", () => {
    const input = `
      <script>
        // #ifdef APP-PLUS
        import BottomPopup from '@/components/BottomPopup.vue'
        // #endif
        // #ifdef H5
        import BottomPopup from '@/components/BottomPopup-uni.vue'
        // #endif
      </script>
    `;
    const out = transformCode(input, "vue");

    expect(out).toContain("@/components/BottomPopup-uni.vue");
    expect(out).toContain("@/components/BottomPopup.vue");
  });
  test("uni的 条件编译- 对象问题", () => {
    const input = `
      <script>
        const a = {
        // #ifdef APP-PLUS
          a:1,
        // #endif
        // #ifdef H5
          a: 2
        // #endif
        }

      </script>
    `;
    const out = transformCode(input, "vue");

    expect(out).toMatch(/a\:\s*1/);
    expect(out).toMatch(/a\:\s*2/);
  });
  test("v-model 方法名：注入赋值并调用原方法", () => {
    const input = `\n      <template>\n        <view>\n          <input v-model="AAAAA.name" @update:model-value="handleInput" />\n        </view>\n      </template>\n    `;
    const out = transformCode(input, "vue");
    expect(out).toMatch(/\$event\s+=>(\S|\s)+?AAAAA\.name\s*=\s*\$event(\S|\s)+?handleInput\(\$event\)/);
  });

  test("v-model 箭头函数：在函数体前注入赋值", () => {
    const input = `\n      <template>\n        <view>\n          <input v-model="AAAAA.name" @update:model-value="(v)=> doSomething(v)" />\n        </view>\n      </template>\n    `;
    const out = transformCode(input, "vue");
    expect(out).toMatch(/v\s+=>(\S|\s)+?AAAAA\.name\s*=\s*v(\S|\s)+?doSomething\(v\)/);
  });

  test("v-model 数组下标：list[index].value", () => {
    const input = `\n      <template>\n        <view>\n          <input v-model="list[index].value" @update:model-value="onChange" />\n        </view>\n      </template>\n    `;
    const out = transformCode(input, "vue");
    expect(out).toMatch(/\$event\s+=>(\S|\s)+?list\[index\]\.value\s*=\s*\$event(\S|\s)+?onChange\(\$event\)/);
  });

  test("v-model 计算属性：form['name']", () => {
    const input = `\n      <template>\n        <view>\n          <input v-model="form['name']" @update:model-value="fn" />\n        </view>\n      </template>\n    `;
    const out = transformCode(input, "vue");
    expect(out).toMatch(/\$event\s+=>(\S|\s)+?form\[\'name\'\]\s*=\s*\$event(\S|\s)+?fn\(\$event\)/);
  });

  test("@update:modelValue 变体：优先使用 modelValue 键", () => {
    const input = `\n      <template>\n        <view>\n          <input v-model="AAAAA.name" @update:modelValue="(v)=> AAAAA.fff = v" />\n        </view>\n      </template>\n    `;
    const out = transformCode(input, "vue");
    // 使用 :modelValue 而不是 :model-value
    expect(out).toMatch(/:modelValue=\"AAAAA\?\.name\"/);
    // 只存在 @update:modelValue
    expect(out).toMatch(/@update:modelValue/);
    expect(out).not.toMatch(/@update:model-value/);
    // 赋值注入使用 v 形参
    expect(out).toMatch(/v\s+=>(\S|\s)+?AAAAA\.fff\s*=\s*v/);
  });
  test("v-model 正常的 不处理", () => {
    const input = `\n      <template>\n        <view>\n          <input v-model="Profile" />\n        </view>\n      </template>\n    `;
    const out = transformCode(input, "vue");
    expect(out).not.toMatch(/@update:model-value/);
    expect(out).toMatch(/v-model/);
  });

  test("v-model 无 update：自动注入默认处理器", () => {
    const input = `\n      <template>\n        <view>\n          <input v-model="Profile.name" />\n        </view>\n      </template>\n    `;
    const out = transformCode(input, "vue");
    // 自动生成 @update:model-value，且包含赋值逻辑
    expect(out).toMatch(/@update:model-value/);
    expect(out).toMatch(/\$event\s+=>(\S|\s)+?Profile\.name\s*=\s*\$event/);
  });
  test("微信 Rate 评分组件：使用 modelValue 变体并注入赋值+回调", () => {
    const input = `\n      <template>\n        <view class="rate-wrap">\n          <RateCard :max="5" :readonly="false" v-model="form?.rate" @update:modelValue="onRateChange" />\n        </view>\n      </template>\n    `;
    const out = transformCode(input, "vue");
    // 选择 modelValue 作为键并保持 PascalCase 组件名
    expect(out).toMatch(/<RateCard/);
    expect(out).toContain(':modelValue="form?.rate"');
    // 回调值应为 $event，且含有赋值 + 原方法调用
    expect(out).toMatch(/\$event\s+=>(\S|\s)+?form\.rate\s*=\s*\$event(\S|\s)+?onRateChange\(\$event\)/);
  });

  test("picker 选择器：参数 e 注入到赋值，保留原体调用", () => {
    const input = `\n      <template>\n        <view>\n          <picker v-model="query?.dateRange" @update:model-value="(e)=> onPick(e.detail.value)">\n            <view class="picker">选择日期</view>\n          </picker>\n        </view>\n      </template>\n    `;
    const out = transformCode(input, "vue");
    // v-model → :model-value，且赋值使用 e 形参
    expect(out).toContain(':model-value="query?.dateRange"');
    expect(out).toMatch(/e\s+=>(\S|\s)+?query\.dateRange\s*=\s*e(\S|\s)+?onPick\(e\?\.detail\?\.value\)/);
  });

  test("input 表单：嵌套成员赋值与方法名回调", () => {
    const input = `\n      <template>\n        <view>\n          <input v-model="form.user.name" @update:model-value="submit" />\n        </view>\n      </template>\n    `;
    const out = transformCode(input, "vue");
    expect(out).toMatch(/\$event\s+=>(\S|\s)+?form\.user\.name\s*=\s*\$event(\S|\s)+?submit\(\$event\)/);
  });

  test("列表 v-for：order?.items 增加 || [] 回退与 key 可选链", () => {
    const input = `\n      <template>\n        <view>\n          <view v-for="(it,i) of order?.items" :key="it.id">{{ it.name }}</view>\n        </view>\n      </template>\n    `;
    const out = transformCode(input, "vue");
    expect(out).toMatch(/\(it,i\)\s+of\s+\(order\?\.items\) \|\| \[\]/);
    expect(out).toContain(':key="it?.id"');
  });

  test("深层 v-for：user?.list?.[idx]?.children 增加回退", () => {
    const input = `\n      <template>\n        <view>\n          <view v-for="(c,j) of user?.list?.[idx]?.children" :key="c.id">{{ c.title }}</view>\n        </view>\n      </template>\n    `;
    const out = transformCode(input, "vue");
    expect(out).toMatch(/\(c,j\)\s+of\s+\(user\?\.list\?\.\[idx\]\?\.children\) \|\| \[\]/);
    expect(out).toContain(':key="c?.id"');
  });
  test("标签上存在空属性 border 这种", () => {
    const input = `\n      <template>\n        <view>\n          <view v-for="(c,j) of user?.list?.[idx]?.children" :key="c.id" border>{{ c.title }}</view>\n        </view>\n      </template>\n    `;
    const out = transformCode(input, "vue");
    expect(out).not.toContain('border=');
  });
  test("标签不要优化成自闭和", () => {
    const input = `<template><view></view></template>`;
    const out = transformCode(input, "vue");
    expect(out).not.toMatch(/<view(\s*)\/(\s*)>/);
  });

  test("赋值语句已存在logi表达式", () => {
    const input = `urgentParams?.value && (urgentParams.value.orderId = String(item?.d.id))`;
    const out = transformCode(input, "js");
    expect(out).toContain('urgentParams?.value && (urgentParams.value.orderId = String(item?.d?.id))');
  });
  test("for 赋值以及有logi表达式", () => {
    const input = `<template><view
            class="info"
            v-for="[channelName, item] in Array.from(PageList.recommendCart.entries()) || []"
            :key="channelName"
          >
            </view></template>`;
    const out = transformCode(input, "vue");
    expect(out).not.toMatch(/\|\|(\s)*\[\](\s)*\|\|(\s)*\[\]/);
    expect(out).toMatch(/\|\|(\s)*\[\]/);
  });
  test("自增自减表达式 存在logi表达式", () => {
    const input = `pagesList?.value?.current?.toString?.() && pagesList.value.current++;`;
    const out = transformCode(input, "js");
    expect(out).toMatch('pagesList.value.current++');
  });
  test("for 赋值以及有logi表达式", () => {
    const input = `<template><view
            class="info"
            v-for="[channelName, item] in Array.from(PageList.recommendCart.entries())"
            :key="channelName"
          >
            </view></template>`;
    const out = transformCode(input, "vue");
    expect(out).toMatch('PageList?.recommendCart?.entries');
    expect(out).toMatch(/\|\|(\s)*\[\]/);
  });
});
