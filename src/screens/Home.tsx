import { catName, useStore } from '../store';
import { monthStatus, pendingReviewMonth, recurringTotals } from '../lib/budget';
import { addMonths, cap, eur, eur0, monthName, shortDay } from '../lib/format';
import { Gauge, Icon, Tag } from '../ui';

export const Home = () => {
  const { data, today, go, openEntry } = useStore();
  const st = monthStatus(data, today);
  const { targetLeisure, targetInvest, lifeBudget } = data.settings;
  const totals = recurringTotals(data.recurring);
  const review = pendingReviewMonth(data, today);
  const lastClose = [...data.closes].sort((a, b) => b.month.localeCompare(a.month))[0];
  const recent = data.entries
    .filter((e) => e.kind === 'leisure' || e.kind === 'exception')
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 4);
  const monthLabel = cap(monthName(st.month));
  const lastDay = `${st.days} ${monthName(st.month)}`;

  const leisureTag: [('ok' | 'warn' | 'bad'), string] =
    st.spent > targetLeisure ? ['bad', 'Dépassée'] : st.spent > st.expectedToday ? ['warn', 'En avance sur le rythme'] : ['ok', 'Dans le rythme'];
  const investTag: [('ok' | 'warn' | 'bad'), string] = st.trend === 'ok' ? ['ok', 'En bonne voie'] : st.trend === 'warn' ? ['warn', 'À surveiller'] : ['bad', 'Manquée'];

  return (
    <div className="scroll">
      <div className="pad">
        <header className="topbar">
          <div className="tb-text">
            <div className="eyebrow">
              {st.daysLeft - 1 > 0 ? `J-${st.daysLeft - 1}` : 'Dernier jour'} · {st.day} {monthName(st.month)}
            </div>
            <h2>{monthLabel}</h2>
          </div>
          <button className="iconbtn" type="button" onClick={() => go({ name: 'settings' })} aria-label="Réglages">
            <Icon name="gear" />
          </button>
        </header>

        <div className="stack">
          {st.trend === 'warn' && (
            <div className="alert" role="status">
              <Icon name="warn" />
              <div>
                <strong>Ta cible d'investissement est menacée</strong>
                <p>
                  À ce rythme, tu investiras environ <b className="num">{eur0(st.projectedInvest)}</b> ce mois-ci, pour une cible de {eur0(targetInvest)}. Pour la tenir, garde-toi <b className="num">{eur(st.perDay)}</b> de loisirs par jour jusqu'au {lastDay}.
                </p>
              </div>
            </div>
          )}
          {st.trend === 'bad' && (
            <div className="alert bad" role="status">
              <Icon name="warn" />
              <div>
                <strong>Ta cible d'investissement ne sera pas tenue</strong>
                <p>
                  Tes dépenses dépassent déjà ce qui permettait d'investir {eur0(targetInvest)}. Sans autre dépense d'ici la fin du mois, tu pourras investir <b className="num">{eur0(Math.max(0, st.available - st.spent))}</b>.
                </p>
              </div>
            </div>
          )}

          <section className="env leisure" aria-labelledby="h-l">
            <div className="env-head">
              <Icon name="wheel" />
              <span id="h-l">Loisirs</span>
              <Tag tone={leisureTag[0]}>{leisureTag[1]}</Tag>
            </div>
            <div className="row">
              <div>
                <div className="big num">{eur(Math.max(0, st.leisureLeft))}</div>
                <div className="small muted">restent sur {eur0(targetLeisure)}</div>
              </div>
              <div className="right">
                <div className="num strong">{eur(st.spent)}</div>
                <div className="small muted">dépensés</div>
              </div>
            </div>
            <Gauge value={st.spent} max={targetLeisure} tick={st.expectedToday} tone="leisure" label={`${eur(st.spent)} dépensés sur ${eur0(targetLeisure)}. Prévu au ${st.day} : ${eur0(st.expectedToday)}.`} />
            <div className="legend">
              <span>
                Trait : prévu au {st.day} {monthName(st.month)} ({eur0(st.expectedToday)})
              </span>
            </div>
          </section>

          <section className="env invest" aria-labelledby="h-i">
            <div className="env-head">
              <Icon name="stock" />
              <span id="h-i">Investissement</span>
              <Tag tone={investTag[0]}>{investTag[1]}</Tag>
            </div>
            <div className="row">
              <div>
                <div className="big num">{eur0(Math.max(0, st.projectedInvest))}</div>
                <div className="small muted">{st.projected ? `prévus fin ${monthName(st.month)}` : 'prévus si tu tiens ton budget loisirs'}</div>
              </div>
              <div className="right">
                <div className="num strong">{eur0(targetInvest)}</div>
                <div className="small muted">cible</div>
              </div>
            </div>
            <Gauge value={st.projectedInvest} max={targetInvest} tone="invest" label={`Projection ${eur0(st.projectedInvest)} pour une cible de ${eur0(targetInvest)}`} />
            <details className="breakdown">
              <summary>
                <Icon name="right" size={16} stroke={2.2} />
                Comment c'est calculé
              </summary>
              <dl className="ledger num">
                <dt>Revenus</dt>
                <dd>{eur0(totals.income + st.extra)}</dd>
                <dt>Charges fixes</dt>
                <dd>− {eur0(totals.fixed)}</dd>
                <dt>Vie courante (forfait)</dt>
                <dd>− {eur0(lifeBudget)}</dd>
                <dt>Épargne de sécurité</dt>
                <dd>− {eur0(totals.safety)}</dd>
                {st.exception > 0 && (
                  <>
                    <dt>Dépenses exceptionnelles</dt>
                    <dd>− {eur0(st.exception)}</dd>
                  </>
                )}
                <dt>{st.projected ? 'Loisirs au rythme actuel' : 'Budget loisirs'}</dt>
                <dd>− {eur0(st.projectedLeisure)}</dd>
                <dt className="total">Reste à investir</dt>
                <dd className="total">{eur0(st.projectedInvest)}</dd>
              </dl>
            </details>
          </section>

          {review ? (
            <button type="button" className="cta-card" onClick={() => go({ name: 'review', month: review })}>
              <Icon name="file" size={26} />
              <div>
                <div className="t">Point de {monthName(review)} à faire</div>
                <div className="s">4 étapes · environ 5 minutes</div>
              </div>
              <span className="chev">
                <Icon name="right" />
              </span>
            </button>
          ) : lastClose ? (
            <div className="cta-card done">
              <Icon name="check" size={24} stroke={2.2} />
              <div>
                <div className="t">{cap(monthName(lastClose.month))} est bouclé</div>
                <div className="s num">
                  {eur0(lastClose.invest)} investis · prochain point le 1er {monthName(addMonths(st.month, 1))}
                </div>
              </div>
            </div>
          ) : null}

          <section>
            <div className="row">
              <h3>Dernières dépenses</h3>
              <button type="button" className="linkbtn" onClick={() => go({ name: 'moves' })}>
                Tout voir
              </button>
            </div>
            {recent.length === 0 ? (
              <p className="muted small">Aucune dépense ce mois-ci. Touche « Dépense » en bas de l'écran pour noter la première.</p>
            ) : (
              <ul className="ruled">
                {recent.map((e) => (
                  <li key={e.id}>
                    <button type="button" className="rowbtn" onClick={() => openEntry(e)}>
                      <span className={`dot ${e.kind}`} />
                      <span className="lbl">
                        {e.label}
                        <span className="sub">
                          {e.kind === 'exception' ? 'Exceptionnel' : catName(data, e.cat)} · {shortDay(e.date)}
                        </span>
                      </span>
                      <span className="amt num">− {eur(e.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
