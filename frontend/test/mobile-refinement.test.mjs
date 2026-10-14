import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync('src/navigation/telegramBack.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {supportsNativeBack}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
test('native back requires a real Telegram launch and a supported client',()=>{
 assert.equal(supportsNativeBack(undefined),false);
 assert.equal(supportsNativeBack({initData:'',version:'9.0',BackButton:{}}),false);
 assert.equal(supportsNativeBack({initData:'signed',version:'6.0',BackButton:{}}),false);
 assert.equal(supportsNativeBack({initData:'signed',version:'6.1',BackButton:{}}),true);
 assert.equal(supportsNativeBack({initData:'signed',version:'10.1',BackButton:{}}),true);
});
test('all scrollable pages are bounded above measured navigation, including keyboard mode',()=>{
 const css=readFileSync('src/mobile-refinement.css','utf8');
 assert.match(css,/height: calc\(var\(--app-viewport-height\) - var\(--app-navigation-clearance\)\)/);
 assert.match(css,/overflow-y: auto/);assert.match(css,/data-keyboard-open/);
 const hook=readFileSync('src/hooks/useChatViewport.ts','utf8');
 assert.match(hook,/safeAreaChanged/);assert.match(hook,/contentSafeAreaChanged/);
 assert.match(readFileSync('src/design-system/components/BottomNavigation.tsx','utf8'),/ResizeObserver/);
});
