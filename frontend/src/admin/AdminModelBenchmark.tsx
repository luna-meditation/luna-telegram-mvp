import snapshot from '../../../docs/LUNA-4.1-MODEL-BENCHMARK.json';
import type {AppLanguage} from '../api';
import {AdminSectionCard} from './AdminPrimitives';
/** Public synthetic QA evidence, not user analytics or current provider billing. */
export function AdminModelBenchmark({language}:{language:AppLanguage}){
 const ru=language==='ru',money=(value:number)=>new Intl.NumberFormat(ru?'ru-RU':'en-GB',{style:'currency',currency:'USD',maximumFractionDigits:6}).format(value/1e6);
 return <AdminSectionCard title={ru?'Сравнение моделей · тестовый снимок':'Model comparison · QA snapshot'}>
  <p>{ru?'100 синтетических RU/EN сценариев для каждой модели · 17 октября 2026. Это первые решения провайдера, не завершённые разговоры и не данные пользователей.':'100 synthetic RU/EN cases per model · 17 October 2026. These are first provider decisions, not complete conversations or user analytics.'}</p>
  <div className="admin41-model-grid">{snapshot.models.map(model=><article key={model.model}><h3>{model.model}</h3><dl>
   <div><dt>{ru?'Ответы / попытки':'Responses / attempts'}</dt><dd>{model.completedResponses} / {model.providerAttempts}</dd></div>
   <div><dt>{ru?'Оценка по usage':'Usage-derived estimate'}</dt><dd>{money(model.knownUsageCostMicrousd)}</dd></div>
   <div><dt>{ru?'Резерв неизвестной стоимости':'Unsettled cost hold'}</dt><dd>{money(model.unsettledCostHoldMicrousd)}</dd></div>
   <div><dt>{ru?'Задержка · медиана / p95':'Latency · median / p95'}</dt><dd>{(model.medianFirstDecisionLatencyMs/1000).toFixed(2)} / {(model.p95FirstDecisionLatencyMs/1000).toFixed(2)} s</dd></div>
   <div><dt>{ru?'Проверенные аргументы инструментов':'Valid tool arguments'}</dt><dd>{model.validToolArguments} / {model.toolCalls}</dd></div>
   <div><dt>{ru?'Отказы защиты провайдера':'Provider policy declines'}</dt><dd>{model.providerPolicyDeclines}</dd></div>
  </dl></article>)}</div>
  <p>{ru?'Разный прогрев кеша и неполный тестовый каталог не позволяют считать это рейтингом стоимости или успешности production. Субъективные оценки не выдуманы; выполнение инструментов проверяется отдельно. Модель production не переключалась.':'Different cache warming and the limited catalog fixture prevent a production cost/success ranking. Subjective scores are not invented; tool execution is verified separately. The production model was not switched.'}</p>
  <details><summary>{ru?'Методика и версия':'Method and source'}</summary><p className="admin40-code">{snapshot.sourceCommit}</p><p>{ru?'398 ответов, 2 терминальных отказа без повторов. Сумма usage и резервов меньше согласованных $2. Денежные значения — не счёт провайдера.':'398 responses, 2 terminal declines without retries. Known usage plus holds remained below the approved $2. Values are not a provider invoice.'}</p></details>
 </AdminSectionCard>;
}
