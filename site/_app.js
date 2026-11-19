/* ---------- votos e pendências ---------- */
let db = null, user = null, myId = null, readOnly = false, mode = "wait";
let votes = {}, mine = store.get("floripa-meus-votos", {}), names = {}, checks = {};
function setSync(s, t) { mode = s; const n = $("#sync"); n.dataset.s = s; $("#sync-l").textContent = t; n.title = t; }
function tally(pid) {
  const all = { ...votes }; if (myId) all[myId] = mine; else all.eu = mine;
  const t = { 2: [], 1: [], 0: [] };
  for (const [uid, v] of Object.entries(all)) if (v && v[pid] != null && t[v[pid]]) t[v[pid]].push(uid);
  return t;
}
const score = pid => { const t = tally(pid); return t[2].length * 2 + t[1].length - t[0].length * 0.5; };
const iniciais = uid => { const n = (names[uid] && names[uid].name) || (uid === "eu" ? "Você" : "?"); return n.split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase(); };
function rostos(uids) {
  const f = el("span", { class: "faces" });
  for (const uid of uids.slice(0, 6)) { const p = names[uid]; f.append(p && p.avatar ? el("img", { src: p.avatar, alt: p.name, title: p.name }) : el("span", { class: "ini", title: (p && p.name) || "Você" }, iniciais(uid))); }
  return f;
}
function voteBox(l, curto) {
  const t = tally(l.id), my = mine[l.id];
  const seg = el("div", { class: "vote", role: "group", "aria-label": "Seu voto para " + l.nome });
  for (const [v, lab, icn, dica] of [[2, "Bora!", "heart", "Quero muito"], [1, "Topo", "thumb", "Se rolar, vou"], [0, "Passo", "x", "Não quero"]])
    seg.append(el("button", { "data-v": v, "aria-pressed": String(my === v), title: dica, disabled: readOnly, onclick: e => { e.preventDefault(); doVote(l.id, v); } }, ic(icn), lab));
  const partes = [[2, "bora"], [1, "topa"], [0, "passa"]].filter(([k]) => t[k].length).map(([k, txt]) => el("span", { class: "tv" }, rostos(t[k]), ` ${t[k].length} ${txt}`));
  return el("div", { class: "votebox" }, seg, curto ? null : el("div", { class: "tally" }, partes.length ? partes : "Ninguém votou ainda. Bora = quero muito · Topo = se rolar, vou · Passo = não quero"));
}
let wT = null, writing = false, again = false;
function doVote(pid, v) {
  if (mine[pid] === v) delete mine[pid]; else mine[pid] = v;
  store.set("floripa-meus-votos", mine); route(true);
  if (db && myId && !readOnly) { clearTimeout(wT); wT = setTimeout(flush, 500); }
}
async function flush() {
  if (writing) { again = true; return; }
  writing = true;
  try { await db.collection("votos").doc(myId).set({ v: { ...mine }, em: Date.now() }); }
  catch (e) { if (e && e.code === "invalid_argument") { readOnly = true; route(true); } else if (e && e.code === "unavailable") setTimeout(flush, 900 + Math.random() * 800); }
  writing = false; if (again) { again = false; flush(); }
}
async function resolveNames(ids) {
  if (!user || !ids.length) return;
  try { const ps = await user.profiles(ids); for (const id of ids) names[id] = { name: (ps[id] && ps[id].name) || "Alguém", avatar: ps[id] && ps[id].avatarUrl }; } catch {}
}
async function initCaps() {
  if (!window.claude || !window.claude.use) { setSync("local", "Votos só neste aparelho"); return; }
  try { [db, user] = await Promise.all([claude.use("db"), claude.use("user")]); } catch {}
  if (!db) { setSync("local", "Votos só neste aparelho"); return; }
  try { myId = user ? await user.id() : null; } catch {}
  try { if (user && (await user.can("data.write")) === false) readOnly = true; } catch {}
  let first = true;
  const timer = setTimeout(() => setSync("slow", "Votos sem resposta"), 10000);
  db.collection("votos").onSnapshot(async snap => {
    if (!snap.metadata.fromCache) clearTimeout(timer);
    const nv = {}; for (const d of snap.docs) { const b = d.data(); if (b && b.v) nv[d.id] = b.v; }
    if (first && myId && nv[myId]) { mine = { ...nv[myId] }; store.set("floripa-meus-votos", mine); }
    else if (first && myId && !nv[myId] && Object.keys(mine).length && !readOnly) flush();
    first = false; if (myId) delete nv[myId]; votes = nv;
    await resolveNames(Object.keys(nv).concat(myId ? [myId] : []).filter(i => !names[i]));
    setSync("ok", `Votos do grupo ao vivo · ${Object.keys(nv).length + (myId && Object.keys(mine).length ? 1 : 0)} votaram`); route(true);
  }, () => { clearTimeout(timer); setSync("err", "Votos fora do ar"); });
  db.collection("pendencias").onSnapshot(async snap => {
    const nc = {}; for (const d of snap.docs) nc[d.id] = d.data(); checks = nc;
    await resolveNames([...new Set(Object.values(nc).flatMap(c => [c && c.por, c && c.dono]).filter(i => i && !names[i]))]); if (curR === "grupo" || curR === "hoje") route(true);
  }, () => {});
}
const estadoPend = id => checks[id] || (mode !== "ok" ? store.get("floripa-pend", {})[id] : null) || {};
async function salvarPend(id, patch) {
  const novo = { ...estadoPend(id), ...patch, em: Date.now() };
  if (db && mode === "ok") {
    checks[id] = novo; route(true);
    try { await db.collection("pendencias").doc(id).set(novo); } catch (e) { if (e && e.code === "invalid_argument") { readOnly = true; route(true); } }
  } else { const l = store.get("floripa-pend", {}); l[id] = novo; store.set("floripa-pend", l); route(true); }
}

/* ---------- tempo: hoje e agora (horário de Brasília) ---------- */
const agora = () => { try { const f = localStorage.getItem("floripa-agora"); if (f) return new Date(f); } catch {} return new Date(); };
const brt = dt => new Date(dt.getTime() - 3 * 3600e3);
function diaDe(dt) { const s = brt(dt).toISOString(); return s.slice(0, 7) === "2026-11" && +s.slice(8, 10) >= 20 && +s.slice(8, 10) <= 29 ? String(+s.slice(8, 10)) : null; }
const horaDe = dt => { const d = brt(dt); return d.getUTCHours() + d.getUTCMinutes() / 60; };
const SAIDA = new Date("2026-11-20T04:00:00-03:00");
function situacao() {
  // devolve {fase, dia, agora: item|null, depois: item|null, amanha: item|null}
  const t = agora(), d = diaDe(t), h = horaDe(t);
  if (t < SAIDA) return { fase: "antes" };
  if (!d && t > new Date("2026-11-30T03:00:00-03:00")) return { fase: "depois" };
  const lista = [];
  const dia = D.dias.find(x => x.id === d), ontem = D.dias.find(x => +x.id === +d - 1);
  if (ontem) for (const it of ontem[modo]) if (hm(it.b) > 24) lista.push({ it, dia: ontem, a: hm(it.a) - 24, b: hm(it.b) - 24 });
  if (dia) for (const it of dia[modo]) lista.push({ it, dia, a: hm(it.a), b: hm(it.b) });
  const vivos = lista.filter(x => x.it.cat !== "trabalho" || true);
  const now = vivos.filter(x => x.a <= h && h < x.b).sort((p, q) => (p.it.cat === "trabalho") - (q.it.cat === "trabalho"))[0] || null;
  const next = vivos.filter(x => x.a > h && x.it.cat !== "trabalho").sort((p, q) => p.a - q.a)[0] || null;
  const amanhaDia = D.dias.find(x => +x.id === +d + 1);
  const amanha = amanhaDia ? { it: amanhaDia[modo].find(x => x.cat !== "trabalho"), dia: amanhaDia } : null;
  return { fase: "durante", dia: d, agora: now, depois: next, amanha };
}

/* ---------- roteiro ---------- */
let modo = store.get("floripa-modo", "sol"), comparar = false, diaSel = diaDe(agora()) || "20";
function setModo(m) { if (m === "cmp") { comparar = !comparar; } else { modo = m; comparar = false; store.set("floripa-modo", m); } applyModo(); route(true); }
function applyModo() {
  document.documentElement.dataset.mode = modo;
  $("#logo").replaceChildren(ic(modo === "sol" ? "wave1" : "rain"));
  document.querySelectorAll("#modeseg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === "cmp" ? comparar : (!comparar && b.dataset.m === modo))));
}
function horariosDe(id) { const out = []; for (const d of D.dias) { const it = d[modo].find(x => x.lugar === id) || d.sol.find(x => x.lugar === id) || d.chuva.find(x => x.lugar === id); if (it) out.push({ d, it }); } return out; }
function slotEl(it, dia, m, i, ehAgora) {
  const id = `s-${dia.id}-${m}-${i}`, trab = it.cat === "trabalho", L = it.lugar ? P[it.lugar] : null;
  const what = el("div", { class: "what" }, it.t || (L ? L.nome : ""));
  const body = el("div", {}, el("span", { class: "t" }, `${fh(it.a)}–${fh(it.b)}`, ehAgora ? el("b", { class: "agora-tag" }, "agora") : null), what, it.nota ? el("div", { class: "note" }, it.nota) : null);
  if (L) {
    const tr = trilhasDe(L.id)[0];
    body.append(el("a", { class: "mini", href: "#lugar-" + L.id, "aria-label": "Abrir ficha de " + L.nome }, el("div", { class: "ph" }, thumb(L)),
      el("div", { class: "mini-b" }, el("h4", {}, L.nome),
        el("div", { class: "meta" }, stars(L), L.da_lagoa && L.da_lagoa.tempo_min != null ? el("span", {}, ic("car"), ` ${L.da_lagoa.tempo_min} min`) : null, tr ? el("span", {}, ic("route"), ` GPX ${String(tr.km).replace(".", ",")} km`) : null),
        el("span", { class: "abre" }, tr ? "Modo trilha" : "Ver ficha", ic("ext")))));
  }
  return el("li", { class: "slot" + (trab ? " trab" : "") + (ehAgora ? " agora" : ""), id },
    el("span", { class: "t" }, `${fh(it.a)}–${fh(it.b)}`),
    el("span", { class: "node", style: `background:${CATC[it.cat] || "var(--surface)"}` }, ic(SLOTI[it.cat] || "sparkle")), body);
}
function ribbon(dia, m) {
  const sunA = pct(5 + 11 / 60), sunB = pct(18 + 50 / 60);
  const r = el("div", { class: "ribbon", role: "img", "aria-label": `Régua do dia ${dia.num}, das 3h às 2h` });
  r.style.background = `linear-gradient(90deg,var(--rn) 0%,var(--rn) ${sunA - 1.5}%,var(--rd) ${sunA + 1.5}%,var(--rd) ${sunB - 1.5}%,var(--rn) ${sunB + 1.5}%,var(--rn) 100%)`;
  dia[m].forEach((it, i) => {
    const L = pct(hm(it.a)), R = pct(hm(it.b));
    if (it.cat === "trabalho") { const w = el("div", { class: "work" }); w.style.left = L + "%"; w.style.width = (R - L) + "%"; r.append(w); return; }
    const b = el("button", { title: `${fh(it.a)}–${fh(it.b)} ${it.t}`, "aria-label": `${fh(it.a)} a ${fh(it.b)}: ${it.t}`, onclick: () => flash(`s-${dia.id}-${m}-${i}`) });
    b.style.left = `calc(${L}% + 1px)`; b.style.width = `calc(${R - L}% - 2px)`; b.style.background = CATC[it.cat] || "var(--line)"; b.style.animationDelay = (i * 0.05) + "s"; r.append(b);
  });
  if (diaDe(agora()) === dia.id) { const n = el("div", { class: "now", title: "agora" }); n.style.left = pct(horaDe(agora())) + "%"; r.append(n); }
  const t = el("div", { class: "ticks", "aria-hidden": "true" });
  for (const h of [3, 6, 9, 12, 15, 18, 21, 24]) { const s = el("span", {}, `${h % 24}h`); s.style.left = pct(h) + "%"; if (h === 3) s.style.transform = "none"; t.append(s); }
  return el("div", {}, r, t);
}
function flash(id) { const n = document.getElementById(id); if (!n) return; n.scrollIntoView({ behavior: "smooth", block: "center" }); n.classList.remove("flash"); void n.offsetWidth; n.classList.add("flash"); }
function planEl(dia, m) {
  const s = situacao(), atual = s.fase === "durante" && s.agora && s.agora.dia === dia ? s.agora.it : null;
  return el("div", { class: "plan", "data-m": m }, el("div", { class: "planhead" }, ic(m === "sol" ? "sun" : "rain"), m === "sol" ? "Plano sol" : "Plano chuva"), ribbon(dia, m), el("ol", { class: "slots" }, dia[m].map((it, i) => slotEl(it, dia, m, i, it === atual))));
}
function mapaDoDia(dia) {
  const ls = []; for (const it of dia[modo]) if (it.lugar && P[it.lugar] && comCoord(P[it.lugar]) && !ls.includes(P[it.lugar])) ls.push(P[it.lugar]);
  if (!ls.length) return null;
  const bb = bboxDe(ls.map(l => [l.coords.lng, l.coords.lat]).concat(BASE ? [[BASE.lng, BASE.lat]] : []), 0.3, 4);
  const mp = mapaSvg({ bb, W: 420, H: 320, marcas: ls, trilhas: D.trilhas.filter(t => ls.some(l => l.id === t.lugar)), rotulos: true, numeros: true, base: true, rotuloAria: `Mapa dos lugares de ${dia.dow} ${dia.num}` });
  return el("div", { class: "mapbox" }, mp);
}
function renderRoteiro(v) {
  const d = D.dias.find(x => x.id === diaSel) || D.dias[0], hojeId = diaDe(agora());
  const chips = el("div", { class: "days", role: "tablist", "aria-label": "Dias" });
  for (const x of D.dias) chips.append(el("button", { class: "dchip" + (x.id === hojeId ? " hoje" : ""), role: "tab", "aria-selected": String(x.id === diaSel), onclick: () => { diaSel = x.id; history.replaceState(null, "", "#dia-" + x.id); route(true); } },
    el("small", {}, x.id === hojeId ? "hoje" : x.dow), el("b", {}, String(x.num)), el("em", {}, x.exp || (x.tipo === "volta" ? "volta" : x.tipo === "feriado" ? "feriado" : "livre")),
    el("span", { class: "wx", "data-r": x.risco, title: RISCO[x.risco] }, ic(RISCOI[x.risco]))));
  const plans = el("div", { class: "plans" + (comparar ? " two" : "") });
  if (comparar) plans.append(planEl(d, "sol"), planEl(d, "chuva")); else plans.append(planEl(d, modo));
  const lado = el("aside", { class: "rot-lado" }, mapaDoDia(d), el("div", { class: "box stk" }, el("div", { class: "eyebrow" }, "Tempo"), el("p", { style: "margin:0" }, el("span", { class: "pill" }, el("i", { style: `background:var(--r-${d.risco})` }), RISCO[d.risco])), el("p", { class: "muted", style: "margin:0;font-size:14px" }, d.previsao), el("p", { class: "muted", style: "margin:0;font-size:14px" }, ic("sunrise"), " 5h11 · ", ic("sunset"), " 18h50")),
    d.alt ? el("div", { class: "alt" }, el("b", {}, "Se o tempo virar: "), d.alt) : null);
  v.replaceChildren(
    el("div", { class: "dias-wrap" }, chips),
    el("div", { class: "dayhead" },
      el("div", { class: "eyebrow" }, `${d.dow} ${d.num} de novembro${d.exp ? " · expediente " + d.exp : ""}`), el("h2", {}, d.titulo), el("p", {}, d.resumo),
      el("div", { class: "dayrow" }, el("span", { class: "pill" }, el("i", { style: `background:var(--r-${d.risco})` }), RISCO[d.risco]), el("span", { class: "pill" }, ic(comparar ? "shuffle" : modo === "sol" ? "sun" : "rain"), comparar ? "Sol × chuva" : modo === "sol" ? "Plano sol" : "Plano chuva"))),
    el("div", { class: "rot-grid" }, plans, lado));
}

/* ---------- hoje ---------- */
function cardItem(rot, x, cls = "") {
  if (!x || !x.it) return null;
  const it = x.it, L = it.lugar ? P[it.lugar] : null;
  return el("article", { class: "agora-card stk " + cls },
    el("div", { class: "eyebrow" }, rot, x.dia ? ` · ${x.dia.dow} ${x.dia.num}` : ""),
    el("div", { class: "ag-h" }, el("span", { class: "node", style: `background:${CATC[it.cat] || "var(--surface)"}` }, ic(SLOTI[it.cat] || "sparkle")),
      el("div", {}, el("div", { class: "mono" }, `${fh(it.a)}–${fh(it.b)}`), el("h3", {}, it.t ? it.t + (L ? " " + L.nome : "") : (L ? L.nome : "")))),
    it.nota ? el("p", { class: "muted", style: "margin:0" }, it.nota) : null,
    L ? acts(L, el("a", { class: "btn hot", href: "#lugar-" + L.id }, ic(trilhasDe(L.id).length ? "boot" : "info"), trilhasDe(L.id).length ? "Modo trilha" : "Ficha")) : null);
}
function renderHoje(v) {
  const s = situacao(), t = agora();
  const urgentes = D.pendencias.filter(p => p.grupo === "agora" && !estadoPend(p.id).feito);
  const blocos = [];
  if (s.fase === "antes") {
    const dias = Math.max(0, Math.ceil((SAIDA - t) / 864e5)), d0 = D.dias[0];
    blocos.push(el("section", { class: "hoje-hero" },
      el("div", { class: "eyebrow" }, "Poços de Caldas → Florianópolis · base na Lagoa"),
      el("h1", {}, dias === 0 ? "É hoje!" : dias === 1 ? "Falta 1 dia" : `Faltam ${dias} dias`),
      el("p", { class: "lede" }, "Saída na sexta 20 às 4h. ", el("span", { class: "hand" }, "4 amigos, 1 carro, zero juízo.")),
      el("div", { class: "dayrow" }, el("span", { class: "pill" }, el("i", { style: `background:var(--r-${d0.risco})` }), "Sex 20: " + RISCO[d0.risco].toLowerCase()), el("a", { class: "pill", href: "#dia-20" }, ic("calendar"), "Ver o primeiro dia"))));
  } else if (s.fase === "durante") {
    const dia = D.dias.find(x => x.id === s.dia);
    blocos.push(el("section", { class: "hoje-hero" }, el("div", { class: "eyebrow" }, `${dia.dow} ${dia.num} · ${dia.titulo}`), el("h1", {}, "Agora"),
      el("div", { class: "dayrow" }, el("span", { class: "pill" }, el("i", { style: `background:var(--r-${dia.risco})` }), RISCO[dia.risco]), el("span", { class: "pill" }, ic("sunset"), "Sol se põe 18h50"))));
    blocos.push(el("div", { class: "agora-lista" }, cardItem("Agora", s.agora, "on"), cardItem("Depois", s.depois), !s.depois ? cardItem("Amanhã", s.amanha) : null,
      !s.agora && !s.depois ? el("p", { class: "empty" }, "Nada marcado agora. Bora ver o resto do dia no Roteiro.") : null));
    if (dia.alt) blocos.push(el("div", { class: "alt" }, el("b", {}, "Se o tempo virar: "), dia.alt));
  } else blocos.push(el("section", { class: "hoje-hero" }, el("h1", {}, "Fim de viagem"), el("p", { class: "lede" }, "Boa volta. Rachem as contas no Guia › Dinheiro.")));
  blocos.push(el("section", { class: "sec" }, el("h2", {}, ic("bolt"), "Fazer agora"),
    urgentes.length ? el("ul", { class: "todo" }, urgentes.slice(0, 4).map(pendItem)) : el("p", { class: "muted" }, "Tudo resolvido por aqui."),
    el("a", { class: "btn", href: "#grupo" }, ic("checksq"), `Ver as ${D.pendencias.length} pendências`)));
  blocos.push(el("section", { class: "sec" }, el("h2", {}, ic("sparkle"), "Decidir junto"),
    el("div", { class: "atalhos" }, Object.entries(D.decidir).map(([k, g]) => el("a", { class: "atalho stk", href: "#decidir-" + k }, ic(k === "praias" ? "waves" : k === "noite" ? "moon" : "sunset"), el("b", {}, g.titulo), el("span", { class: "muted" }, `${g.itens.length} opções`))))));
  blocos.push(el("section", { class: "sec" }, el("h2", {}, ic("info"), "Guia rápido"),
    el("div", { class: "atalhos" }, [["hospedagem", "Hospedagem", "pin"], ["emergencia", "Emergência", "alert"], ["tempo", "Tempo e maré", "cloud"], ["malas", "O que levar", "backpack"], ["sc21k", "SC21K", "run"], ["dinheiro", "Dinheiro", "ticket"]].map(([a, t2, i]) => el("a", { class: "atalho stk", href: "#guia-" + a }, ic(i), el("b", {}, t2))))));
  v.replaceChildren(...blocos);
}

/* ---------- explorar: lugares, decidir, mapa ---------- */
function explorarTopo(ativo) {
  return el("div", { class: "seg-exp", role: "tablist", "aria-label": "Explorar" }, [["lugares", "Lugares", "list"], ["decidir", "Decidir", "sparkle"], ["mapa", "Mapa", "map"]].map(([r, t, i]) => el("a", { href: "#" + r, role: "tab", "aria-selected": String(ativo === r) }, ic(i), t)));
}
const ATALHOS = [
  ["praias", "Praias", "waves", l => l.categoria === "praia" || ["joaquina-e-dunas", "piscinas-naturais-barra-da-lagoa", "lagoinha-do-leste"].includes(l.id)],
  ["trilhas", "Trilhas", "mountain", l => l.categoria === "trilha" || trilhasDe(l.id).length > 0],
  ["sol", "Pôr do sol", "sunset", l => D.decidir["por-do-sol"].itens.some(i => i.id === l.id) || l.categoria === "mirante"],
  ["noite", "Noite", "moon", l => l.categoria === "noite"],
  ["comida", "Comer", "fork", l => l.categoria === "comida"],
  ["perto", "Perto de casa", "pin", l => l.da_lagoa && l.da_lagoa.tempo_min != null && l.da_lagoa.tempo_min <= 10]
];
let fAt = null, fReg = null, fBusca = "", fOrdem = "roteiro", fVista = store.get("floripa-vista", "grade");
function renderLugares(v) {
  const regs = [...new Set(D.lugares.map(l => l.regiao))];
  v.replaceChildren(explorarTopo("lugares"),
    el("div", { class: "toolbar" },
      el("input", { type: "search", id: "busca", placeholder: "Buscar: ostra, trilha, balada…", value: fBusca, "aria-label": "Buscar lugar", oninput: e => { fBusca = e.target.value; renderGrid(); } }),
      el("div", { class: "tb-row" },
        el("select", { id: "regiao", "aria-label": "Região", onchange: e => { fReg = e.target.value || null; renderGrid(); } }, el("option", { value: "" }, "Ilha toda"), regs.map(r => el("option", { value: r, selected: fReg === r }, REG[r] || r))),
        el("select", { id: "ordem", "aria-label": "Ordem", onchange: e => { fOrdem = e.target.value; renderGrid(); } }, [["roteiro", "No roteiro primeiro"], ["votos", "Mais bora"], ["nota", "Nota no Google"], ["dist", "Mais perto"]].map(([k, t]) => el("option", { value: k, selected: fOrdem === k }, t))),
        el("div", { class: "toggle mini-t", role: "group", "aria-label": "Visualização" }, [["grade", "grid", "Grade"], ["lista", "list", "Lista"]].map(([k, i, t]) => el("button", { "aria-pressed": String(fVista === k), "aria-label": t, onclick: () => { fVista = k; store.set("floripa-vista", k); renderLugares(v); } }, ic(i === "grid" ? "camera" : "list")))))),
    el("div", { class: "chips" }, el("button", { class: "chip", "aria-pressed": String(fAt == null), onclick: () => { fAt = null; renderLugares(v); } }, "Tudo"), ATALHOS.map(([k, t, i]) => el("button", { class: "chip", "aria-pressed": String(fAt === k), onclick: () => { fAt = k; renderLugares(v); } }, ic(i), t))),
    el("div", { class: "grid " + fVista, id: "grid" }));
  renderGrid();
}
function renderGrid() {
  const q = fBusca.trim().toLowerCase(), nota = l => (G[l.id] && G[l.id].nota) || 0, f = fAt ? ATALHOS.find(a => a[0] === fAt)[3] : () => true;
  let ls = D.lugares.filter(l => f(l) && (fReg == null || l.regiao === fReg) && (!q || (l.nome + " " + l.resumo + " " + (CATN[l.categoria] || "")).toLowerCase().includes(q)));
  ls = ls.slice().sort((a, b) => fOrdem === "votos" ? score(b.id) - score(a.id) || nota(b) - nota(a) :
    fOrdem === "nota" ? nota(b) - nota(a) : fOrdem === "dist" ? ((a.da_lagoa && a.da_lagoa.tempo_min) ?? 999) - ((b.da_lagoa && b.da_lagoa.tempo_min) ?? 999) :
    (noRoteiro[b.id] ? 1 : 0) - (noRoteiro[a.id] ? 1 : 0) || score(b.id) - score(a.id) || nota(b) - nota(a));
  const g = $("#grid"); if (!g) return; g.replaceChildren();
  if (!ls.length) { g.append(el("div", { class: "empty" }, "Nada com esses filtros. Tenta outra busca.")); return; }
  for (const l of ls) {
    const tr = trilhasDe(l.id).length, t = tally(l.id);
    g.append(el("a", { class: "card", href: "#lugar-" + l.id },
      el("div", { class: "cph" }, thumb(l), noRoteiro[l.id] ? el("span", { class: "sticker" }, ic("calendar"), "roteiro") : null, tr ? el("span", { class: "sticker sea dir" }, ic("route"), "GPX") : null),
      el("div", { class: "cb" },
        el("span", { class: "cat" }, ic(CATI[l.categoria] || "compass"), CATN[l.categoria] || l.categoria),
        el("h3", {}, l.nome),
        el("div", { class: "meta" }, stars(l), l.da_lagoa && l.da_lagoa.tempo_min != null ? el("span", {}, ic("car"), ` ${l.da_lagoa.tempo_min} min`) : null, t[2].length ? el("span", { class: "bora" }, ic("heart"), ` ${t[2].length}`) : null),
        el("p", {}, l.resumo))));
  }
}
let decCat = "praias";
function renderDecidir(v, cat) {
  if (cat && D.decidir[cat]) decCat = cat;
  const grupo = D.decidir[decCat], itens = grupo.itens.filter(i => P[i.id]);
  const cards = el("div", { class: "swipe" }, itens.map((i, n) => {
    const l = P[i.id], md = (D.midia || {})[l.id] || {}, vid = (md.videos || [])[0], t = tally(l.id);
    return el("article", { class: "dcard stk" },
      el("a", { class: "dph", href: "#lugar-" + l.id }, foto(l) ? imgEl(foto(l), l.nome, n === 0 ? { loading: "eager" } : {}) : glyph(l.categoria), el("span", { class: "dnum" }, `${n + 1}/${itens.length}`)),
      el("div", { class: "dbody" },
        el("h3", {}, l.nome), el("p", { class: "gancho" }, i.gancho),
        el("div", { class: "vibes" }, el("span", { class: "vb" }, ic("sparkle"), i.publico), i.mar && i.mar !== "—" ? el("span", { class: "vb" }, ic("waves"), i.mar) : null, el("span", { class: "vb" }, ic("fork"), i.estrutura), el("span", { class: "vb" }, ic("clock"), i.hora)),
        el("div", { class: "meta" }, stars(l), l.da_lagoa && l.da_lagoa.tempo_min != null ? el("span", {}, ic("car"), ` ${l.da_lagoa.tempo_min} min da Lagoa`) : null),
        vid ? el("a", { class: "vid", href: vid.url, target: "_blank", rel: "noopener" }, el("span", { class: "play" }, "▶"), el("span", {}, el("b", {}, vid.titulo), el("small", { class: "muted" }, [vid.canal, vid.publicado].filter(Boolean).join(" · ")))) : null,
        voteBox(l), el("a", { class: "btn", href: "#lugar-" + l.id }, ic("info"), "Ficha completa")));
  }));
  const linhas = [["Público", i => i.publico], ["Mar", i => i.mar], ["Estrutura", i => i.estrutura], ["Melhor hora", i => i.hora], ["Da Lagoa", i => { const l = P[i.id]; return l.da_lagoa && l.da_lagoa.tempo_min != null ? `${l.da_lagoa.tempo_min} min` : "—"; }], ["Google", i => G[i.id] && G[i.id].nota ? String(G[i.id].nota).replace(".", ",") : "—"], ["Bora", i => String(tally(i.id)[2].length)]];
  v.replaceChildren(explorarTopo("decidir"),
    el("div", { class: "chips" }, Object.entries(D.decidir).map(([k, g]) => el("a", { class: "chip", href: "#decidir-" + k, "aria-pressed": String(k === decCat) }, ic(k === "praias" ? "waves" : k === "noite" ? "moon" : "sunset"), g.titulo))),
    el("p", { class: "muted", style: "margin:4px 0 10px" }, "Arrasta para o lado, vota em cada um e confere a tabela embaixo."),
    cards,
    el("section", { class: "sec" }, el("h2", {}, ic("list"), "Lado a lado"),
      el("div", { class: "tabela-wrap" }, el("table", { class: "tabela" }, el("thead", {}, el("tr", {}, el("th", {}, ""), itens.map(i => el("th", {}, el("a", { href: "#lugar-" + i.id }, P[i.id].nome.replace(/\s*\(.*\)$/, "")))))),
        el("tbody", {}, linhas.map(([k, f]) => el("tr", {}, el("th", {}, k), itens.map(i => el("td", {}, f(i))))))))));
}

/* ---------- mapa esquemático (SVG, sem tiles) ---------- */
const NS = "http://www.w3.org/2000/svg";
const sv = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v); for (const c of kids.flat()) if (c) n.append(c); return n; };
const MCOL = { trilha: "var(--leaf)", praia: "var(--sea)", mirante: "var(--sun)", noite: "var(--violet)", comida: "var(--sol)", atividade: "var(--coral)", passeio: "var(--c-estrada)", evento: "var(--coral)", "bate-volta": "var(--c-estrada)" };
const comCoord = l => l.coords && l.coords.lat != null;
const hav = (a, b) => { const R = 6371000, r = Math.PI / 180, dp = (b[0] - a[0]) * r, dl = (b[1] - a[1]) * r; const h = Math.sin(dp / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const dtxt = m => m < 950 ? `${Math.round(m / 50) * 50 || 50} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",")} km`;
function bboxDe(pts, pad = 0.1, minKm = 0) {
  let w = 1e9, e = -1e9, s = 1e9, n = -1e9;
  for (const [lng, lat] of pts) { w = Math.min(w, lng); e = Math.max(e, lng); s = Math.min(s, lat); n = Math.max(n, lat); }
  const cl = (n + s) / 2, cg = (e + w) / 2, minLat = minKm / 111.32, minLng = minKm / (111.32 * Math.cos(cl * Math.PI / 180));
  const hl = Math.max((n - s) / 2 * (1 + pad), minLat / 2), hg = Math.max((e - w) / 2 * (1 + pad), minLng / 2);
  return { w: cg - hg, e: cg + hg, s: cl - hl, n: cl + hl };
}
const ILHA_BB = bboxDe(D.ilha, 0.03);
const BASE = P["centrinho-da-lagoa"] && comCoord(P["centrinho-da-lagoa"]) ? { lat: P["centrinho-da-lagoa"].coords.lat, lng: P["centrinho-da-lagoa"].coords.lng } : null;
function proj(bb, W, H) {
  const c = Math.cos((bb.s + bb.n) / 2 * Math.PI / 180), dx = (bb.e - bb.w) * c, dy = bb.n - bb.s, k = Math.min(W / dx, H / dy), ox = (W - dx * k) / 2, oy = (H - dy * k) / 2;
  return { x: lng => ox + (lng - bb.w) * c * k, y: lat => oy + (bb.n - lat) * k, k };
}
const caminho = (pts, P2, fechar) => "M" + pts.map(p => `${P2.x(p[0]).toFixed(1)},${P2.y(p[1]).toFixed(1)}`).join("L") + (fechar ? "Z" : "");
function mapaSvg({ bb, W, H, marcas, trilhas, destaque, selecionado, rotulos, numeros, base, onSel, rotuloAria }) {
  const Pj = proj(bb, W, H), s = sv("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": rotuloAria || "Mapa esquemático", class: "map" });
  s.append(sv("rect", { width: W, height: H, class: "m-mar" }), sv("path", { d: caminho(D.ilha, Pj, true), class: "m-terra" }));
  if (trilhas) for (const t of trilhas) for (const ln of t.linhas) s.append(sv("path", { d: caminho(ln, Pj), class: "m-trilha" + (t._d ? " m-trilha-d" : "") + (t.estimada ? " m-trilha-e" : "") }));
  if (base && BASE) { const x = Pj.x(BASE.lng), y = Pj.y(BASE.lat); const g = sv("g", { class: "m-base" }); g.append(sv("rect", { x: x - 9, y: y - 9, width: 18, height: 18, rx: 5 }), sv("path", { d: `M${x - 5},${y + 1}L${x},${y - 4}L${x + 5},${y + 1}M${x - 3.5},${y}V${y + 4.5}H${x + 3.5}V${y}`, class: "m-casa" }), sv("title", {}, document.createTextNode("Base: casa na Lagoa (bairro)"))); s.append(g); }
  const lab = [];
  marcas.forEach((l, i) => {
    const x = Pj.x(l.coords.lng), y = Pj.y(l.coords.lat); if (x < -10 || y < -10 || x > W + 10 || y > H + 10) return;
    const on = l.id === destaque || l.id === selecionado;
    const g = sv("g", { class: "m-pt" + (on ? " on" : ""), tabindex: "0", role: "link", "aria-label": l.nome, style: "cursor:pointer" });
    if (on) g.append(sv("circle", { cx: x, cy: y, r: 10, class: "halo" }));
    const c = sv("circle", { cx: x, cy: y, r: on ? 9 : numeros ? 9 : 6, fill: MCOL[l.categoria] || "var(--sea)", class: "m-c" }); c.style.animationDelay = Math.min(i, 40) * 0.015 + "s";
    g.append(sv("circle", { cx: x, cy: y, r: 16, fill: "transparent" }), c, sv("title", {}, document.createTextNode(l.nome)));
    if (numeros) { const tn = sv("text", { x, y: y + 4, class: "m-num", "text-anchor": "middle" }); tn.textContent = String(i + 1); g.append(tn); }
    const go = () => { if (onSel) onSel(l.id); else location.hash = "lugar-" + l.id; };
    g.addEventListener("click", go); g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    s.append(g);
    if (rotulos || on) lab.push([x, y, l.nome.replace(/\s*\(.*\)$/, ""), on]);
  });
  for (const [x, y, t, forte] of lab) { const right = x < W * 0.62; const tx = sv("text", { x: x + (right ? 12 : -12), y: y + 4, "text-anchor": right ? "start" : "end", class: "m-lab" + (forte ? " forte" : "") }); tx.textContent = t.length > 24 ? t.slice(0, 23) + "…" : t; s.append(tx); }
  s._P = Pj;
  return s;
}
const trilhasDe = id => D.trilhas.filter(t => t.lugar === id);

/* ---------- modo trilha: perfil de altitude ligado ao mapa ---------- */
function ponto_em(t, km) {
  let acc = 0;
  for (const ln of t.linhas) for (let i = 1; i < ln.length; i++) {
    const a = ln[i - 1], b = ln[i], d = hav([a[1], a[0]], [b[1], b[0]]) / 1000;
    if (acc + d >= km) { const f = d ? (km - acc) / d : 0; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
    acc += d;
  }
  return t.linhas.at(-1).at(-1);
}
function perfilEl(t, mapa) {
  if (!t.perfil || t.perfil.length < 2) return null;
  const W = 600, H = 130, pl = 34, pr = 8, pt = 10, pb = 20, kmMax = t.perfil.at(-1)[0] || t.km;
  const hMin = Math.min(...t.perfil.map(p => p[1])), hMax = Math.max(...t.perfil.map(p => p[1])), hTop = Math.max(hMax, hMin + 30);
  const x = k => pl + (k / kmMax) * (W - pl - pr), y = h => pt + (1 - (h - hMin) / (hTop - hMin)) * (H - pt - pb);
  const linha = t.perfil.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const s = sv("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", role: "img", "aria-label": `Perfil de altitude: de ${hMin} a ${hMax} m em ${String(t.km).replace(".", ",")} km` });
  for (const h of [hMin, Math.round((hMin + hTop) / 2), hTop]) { s.append(sv("line", { x1: pl, x2: W - pr, y1: y(h), y2: y(h), class: "grade" })); const tx = sv("text", { x: 2, y: y(h) + 4 }); tx.textContent = h + " m"; s.append(tx); }
  for (const k of [0, kmMax / 2, kmMax]) { const tx = sv("text", { x: x(k), y: H - 4, "text-anchor": k === 0 ? "start" : k === kmMax ? "end" : "middle" }); tx.textContent = (Math.round(k * 10) / 10).toString().replace(".", ",") + " km"; s.append(tx); }
  s.append(sv("path", { d: `${linha}L${x(kmMax)},${H - pb}L${x(0)},${H - pb}Z`, class: "area" }), sv("path", { d: linha, class: "linha" }));
  const cur = sv("line", { x1: 0, x2: 0, y1: pt, y2: H - pb, class: "cursor", visibility: "hidden" }), dot = sv("circle", { r: 5, class: "ponto", visibility: "hidden" });
  s.append(cur, dot);
  const leitura = el("span", { class: "leitura" }, `↑ ${t.alt_max} m no ponto mais alto`);
  let andar = null;
  if (mapa) { andar = sv("circle", { r: 7, class: "m-andar", visibility: "hidden" }); mapa.append(andar); }
  const mover = ev => {
    const r = s.getBoundingClientRect(), fx = (ev.clientX - r.left) / r.width * W, k = Math.max(0, Math.min(kmMax, (fx - pl) / (W - pl - pr) * kmMax));
    let p = t.perfil[0]; for (const q of t.perfil) if (Math.abs(q[0] - k) < Math.abs(p[0] - k)) p = q;
    cur.setAttribute("x1", x(k)); cur.setAttribute("x2", x(k)); cur.setAttribute("visibility", "visible");
    dot.setAttribute("cx", x(p[0])); dot.setAttribute("cy", y(p[1])); dot.setAttribute("visibility", "visible");
    leitura.textContent = `${(Math.round(k * 10) / 10).toString().replace(".", ",")} km · ${p[1]} m`;
    if (andar && mapa._P) { const g = ponto_em(t, k); andar.setAttribute("cx", mapa._P.x(g[0])); andar.setAttribute("cy", mapa._P.y(g[1])); andar.setAttribute("visibility", "visible"); }
  };
  s.addEventListener("pointermove", mover); s.addEventListener("pointerdown", mover);
  return el("div", { class: "perfil" }, s, leitura);
}
const tempoTrilha = t => { const h = t.km / 3 + (t.ganho || 0) / 500; const m = Math.round(h * 60 / 5) * 5; return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; };
function blocoTrilha(t, l, mapa) {
  const [la, lo] = t.inicio, z = 16;
  return el("article", { class: "trilha" },
    el("div", { class: "trilha-h" }, el("div", {}, el("div", { class: "eyebrow", style: "color:#06200F" }, "Modo trilha"), el("h3", {}, t.nome)), t.estimada ? el("span", { class: "sticker coral" }, ic("alert"), "rota estimada") : el("span", { class: "sticker" }, ic("check"), "traçado do OSM")),
    el("div", { class: "tstats" },
      el("div", {}, el("b", {}, String(t.km).replace(".", ",")), el("span", {}, "km")),
      el("div", {}, el("b", {}, t.ganho != null ? "+" + t.ganho : "–"), el("span", {}, "m de subida")),
      el("div", {}, el("b", {}, t.alt_max != null ? String(t.alt_max) : "–"), el("span", {}, "m no topo")),
      el("div", {}, el("b", {}, tempoTrilha(t)), el("span", {}, "andando, só ida"))),
    perfilEl(t, mapa),
    el("p", { class: "tnota", style: "padding:0 14px 10px" }, ic("info"), mapa ? "Passe o dedo no perfil: a bolinha vermelha anda no mapa de \"Como chegar\"." : "Altitude do SRTM (30 m), aproximada."),
    el("div", { class: "tacts" },
      ext(t.gpx, "Baixar GPX", "btn hot", "download"),
      ext(`https://www.google.com/maps/search/?api=1&query=${la},${lo}`, "Início no Maps", "btn pri", "pin"),
      ext(`https://waze.com/ul?ll=${la},${lo}&navigate=yes`, "Início no Waze", "btn", "car")),
    el("details", { class: "tapps" }, el("summary", {}, "Abrir em outros mapas"),
      el("div", { class: "grid-apps" },
        ext(`https://mapy.com/en/turisticka?x=${lo}&y=${la}&z=${z}`, "Mapy (trilhas)", "btn", "map"),
        ext(`https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=${z}/${la}/${lo}`, "OpenStreetMap", "btn", "globe"),
        ext(`https://hiking.waymarkedtrails.org/#?map=${z}/${la}/${lo}`, "Waymarked Trails", "btn", "route"),
        ext(`https://www.strava.com/heatmap#${z}.00/${lo}/${la}/hot/all`, "Strava Heatmap (login)", "btn", "bolt")),
      el("p", { class: "tnota" }, ic("alert"), t.estimada ? "Rota calculada sobre caminhos do OpenStreetMap, não gravada por alguém. Siga as marcas no chão." : "Traçado do OpenStreetMap: pode faltar pedaço. Importe o GPX no Wikiloc, OsmAnd, Organic Maps ou Komoot e baixe o mapa offline antes.")));
}

/* ---------- ficha: foto primeiro, o resto recolhível ---------- */
const fact = (k, val) => val ? el("div", {}, el("dt", {}, k), el("dd", {}, val)) : null;
const list = arr => arr && arr.length ? el("ul", {}, arr.map(x => el("li", {}, x))) : null;
function sec(t, icn, ...c) { const k = c.flat().filter(Boolean); return k.length ? el("section", { class: "sec" }, el("h2", {}, ic(icn), t), k) : null; }
function dobra(t, icn, ...c) { const k = c.flat().filter(Boolean); return k.length ? el("details", { class: "dobra" }, el("summary", {}, ic(icn), el("span", {}, t)), el("div", { class: "dobra-c" }, k)) : null; }
const LOCTXT = {
  A: "Ponto conferido: o Google e o OpenStreetMap concordam, a menos de 300 m.",
  B: "Ponto provável: o Google e o OpenStreetMap divergem em até 1,5 km.",
  C: "Ponto aproximado: uma fonte só, ou fontes distantes. Em trilha, é o início ou a referência."
};
const CHECK_TRILHA = ["Baixe o GPX e o mapa offline ainda no wi-fi da casa.", "Tênis com sola boa: pedra molhada aqui escorrega de verdade.", "Água (1,5 L por pessoa), lanche e saco para trazer o lixo.", "Lanterna de cabeça se for antes do sol ou depois das 18h.", "Avise no grupo o horário de volta. Com raio, não entre."];
function verComoE(l) {
  const md = (D.midia || {})[l.id]; if (!md) return null;
  const vids = (md.videos || []).slice(0, 3), igs = (md.instagram || []).slice(0, 3), pv = md.pontos_de_vista || [];
  if (!vids.length && !igs.length && !pv.length) return null;
  const yid = u => { const m = /(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/.exec(u || ""); return m ? m[1] : null; };
  return sec("Ver como é", "camera",
    md.vibe ? el("p", { class: "gancho" }, md.vibe) : null,
    vids.length ? el("div", { class: "vids" }, vids.map(v2 => { const id = yid(v2.url); return el("a", { class: "vid", href: v2.url, target: "_blank", rel: "noopener" },
      el("span", { class: "vthumb" }, id ? el("img", { src: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, alt: "", loading: "lazy", onerror: e => e.target.remove() }) : null, el("span", { class: "play" }, "▶")),
      el("span", { class: "vtx" }, el("b", {}, v2.titulo), el("small", { class: "muted" }, [v2.canal, v2.publicado, v2.duracao].filter(Boolean).join(" · ")), v2.mostra ? el("small", {}, v2.mostra + (v2.melhor_trecho ? ` (vá para ${v2.melhor_trecho})` : "")) : null)); })) : null,
    igs.length ? el("div", { class: "grid-apps" }, igs.map(g => ext(g.url, g.nota || ("Instagram: " + g.tipo), "btn", "camera"))) : null,
    pv.length ? el("div", {}, el("b", {}, "Os ângulos que valem a foto"), list(pv)) : null);
}
function renderLugar(v, id) {
  const l = P[id];
  if (!l) { v.replaceChildren(el("a", { class: "btn", href: "#lugares" }, ic("arrowl"), "Lugares"), el("div", { class: "empty" }, "Lugar não encontrado.")); return; }
  const tr = l.trilha, trs = trilhasDe(l.id), extl = D.links[l.id] || [], fotos = l.fotos || [], hor = horariosDe(l.id);
  const url = k => l.links && l.links[k] && /^https?:/.test(l.links[k]) ? l.links[k] : null;
  let mapa = null, perto = [];
  if (comCoord(l)) {
    const pts = [[l.coords.lng, l.coords.lat]]; for (const t of trs) for (const ln of t.linhas) pts.push(...ln);
    const bb = bboxDe(pts, 0.25, 2.4), centro = [l.coords.lat, l.coords.lng];
    perto = D.lugares.filter(o => o.id !== l.id && comCoord(o)).map(o => ({ o, m: hav(centro, [o.coords.lat, o.coords.lng]) })).filter(x => x.m <= 6000).sort((a, b) => a.m - b.m);
    const marcasMapa = [l, ...perto.filter(x => x.o.coords.lng > bb.w && x.o.coords.lng < bb.e && x.o.coords.lat > bb.s && x.o.coords.lat < bb.n).slice(0, 5).map(x => x.o)];
    mapa = mapaSvg({ bb, W: 520, H: 340, marcas: marcasMapa, trilhas: trs.map(t => ({ ...t, _d: true })), destaque: l.id, rotulos: true, base: true, rotuloAria: `Mapa esquemático de ${l.nome} e do que há em volta` });
  }
  const loc = l.loc ? LOCTXT[l.loc.classe] : (comCoord(l) ? "Ponto do OpenStreetMap, aproximado." : "Sem ponto no mapa: use o endereço.");
  const dl = l.da_lagoa, porque = (l.destaques || []).slice(0, 3);
  const fb = $("#fbar"), t0 = trs[0];
  fb.replaceChildren(...[t0 ? ext(t0.gpx, "GPX", "btn hot", "download") : null, mapsUrl(l) ? ext(mapsUrl(l), "Maps", "btn pri", "pin") : null, wazeUrl(l) ? ext(wazeUrl(l), "Waze", "btn", "car") : null].filter(Boolean));
  fb.hidden = !fb.children.length; document.body.classList.toggle("tem-fbar", !fb.hidden);
  const galeria = fotos.length ? el("div", { class: "fgal", role: "region", "aria-label": "Fotos" }, fotos.map((f, i) => el("figure", {}, imgEl(f.arq, l.nome, i === 0 ? { loading: "eager", fetchpriority: "high", srcset: f.t && f.t !== f.arq ? `${f.t} 420w, ${f.arq} 1080w` : null, sizes: "(min-width: 900px) 60vw, 100vw" } : { srcset: f.t && f.t !== f.arq ? `${f.t} 420w, ${f.arq} 1080w` : null, sizes: "(min-width: 900px) 60vw, 100vw" }), el("figcaption", {}, "Foto: " + (f.autor || "autor não informado") + (f.licenca ? ", " + f.licenca : "") + (f.data ? " · " + f.data.slice(0, 4) : ""))))) : el("div", { class: "fgal vazio" }, glyph(l.categoria));
  const aside = el("aside", { class: "side", "aria-label": "Ir e decidir" },
    el("div", { class: "box stk so-desk" }, el("div", { class: "eyebrow" }, "Ir"), el("div", { class: "acts" }, mapsUrl(l) ? ext(mapsUrl(l), "Maps", "btn pri", "pin") : null, wazeUrl(l) ? ext(wazeUrl(l), "Waze", "btn", "car") : null, t0 ? ext(t0.gpx, "GPX", "btn hot", "download") : null)),
    el("div", { class: "box stk" }, el("div", { class: "eyebrow" }, "Bora ou não bora?"), voteBox(l)),
    el("div", { class: "box stk" }, el("div", { class: "eyebrow" }, "Reserva e contato"),
      ...["ingressos", "reserva", "site", "instagram"].map(k => { const u = url(k), t = l.links && l.links[k]; if (u) return ext(u, { ingressos: "Ingressos", reserva: "Reservar", site: "Site", instagram: "Instagram" }[k], "btn", { ingressos: "ticket", reserva: "calendar", site: "globe", instagram: "camera" }[k]); if (t && k === "reserva") return el("p", { class: "muted", style: "margin:0;overflow-wrap:anywhere" }, ic("phone"), " ", t); return null; }),
      mapsUrl(l) ? ext(mapsUrl(l), "Fotos e avaliações no Google", "btn", "camera") : null));
  v.replaceChildren(
    el("section", { class: "fhero" }, galeria,
      el("div", { class: "fhero-t" },
        el("nav", { class: "crumbs", "aria-label": "Caminho até aqui" }, el("a", { href: "#lugares" }, ic("arrowl"), "Lugares")),
        el("span", { class: "cat" }, ic(CATI[l.categoria] || "compass"), (CATN[l.categoria] || l.categoria) + " · " + (REG[l.regiao] || l.regiao)),
        el("h1", {}, l.nome),
        el("div", { class: "selos" }, stars(l) ? el("span", { class: "pill" }, stars(l)) : null, dl && dl.tempo_min != null ? el("span", { class: "pill" }, ic("car"), `${dl.tempo_min} min da Lagoa`) : null, trs.length ? el("span", { class: "sticker sea" }, ic("route"), `${trs.length} GPX`) : null),
        el("p", { class: "lede" }, l.resumo))),
    el("div", { class: "fcorpo" },
      el("div", { class: "fmain" },
        hor.length ? el("div", { class: "noroteiro" }, ic("calendar"), el("span", {}, "No roteiro: "), hor.map(({ d, it }) => el("a", { class: "pill", href: "#dia-" + d.id }, `${d.dow} ${d.num} · ${fh(it.a)}`))) : null,
        el("div", { class: "so-mob" }, voteBox(l)),
        porque.length ? sec("Por que ir", "sparkle", el("ul", { class: "porque" }, porque.map(t => el("li", {}, el("span", { class: "ic" }, ic(CATI[l.categoria] || "sparkle")), el("span", {}, t))))) : null,
        verComoE(l),
        trs.length ? sec("Modo trilha", "boot", trs.map((t, i) => blocoTrilha(t, l, i === 0 ? mapa : null)),
          extl.length ? el("div", { class: "box stk" }, el("div", { class: "eyebrow" }, "Wikiloc, Komoot e guias"), el("div", { class: "grid-apps" }, extl.map(e => ext(e.u, e.t, "btn", "ext")))) : null,
          el("div", { class: "box stk" }, el("div", { class: "eyebrow" }, "Antes de entrar no mato"), el("ul", { class: "checklist" }, CHECK_TRILHA.map(t => el("li", {}, ic("checksq"), el("span", {}, t)))))) : null,
        !trs.length && extl.length ? sec("Mapas e relatos", "route", el("div", { class: "grid-apps" }, extl.map(e => ext(e.u, e.t, "btn", "ext")))) : null,
        l.cuidados && l.cuidados.length ? el("section", { class: "sec" }, el("div", { class: "warnbox" }, el("b", {}, ic("alert"), "Se liga"), list(l.cuidados))) : null,
        dobra("Como chegar e mapa", "pin",
          el("ol", { class: "passos" }, [dl && dl.tempo_min != null ? `Da casa da Lagoa são ${dl.tempo_min} min de carro${dl.km != null ? ` (${dl.km} km)` : ""}.${dl.obs ? " " + dl.obs : ""}` : null, l.estacionamento ? "Estacionamento: " + l.estacionamento : null, tr && tr.inicio ? "Início da trilha: " + tr.inicio : null, l.endereco ? "Endereço: " + l.endereco : null].filter(Boolean).map((t, i) => el("li", {}, el("span", { class: "n" }, String(i + 1)), el("span", {}, t)))),
          mapa ? el("div", { class: "mapbox" }, mapa) : null, el("p", { class: "mapnota" }, ic("info"), loc + (mapa ? " Mapa em esquema, sem ruas; a casinha é o bairro da casa." : ""))),
        dobra("Horário, preço e público", "clock", el("dl", { class: "facts2" }, fact("Duração", l.duracao), fact("Melhor horário", l.melhor_horario), fact("Horários", l.horarios), fact("Preços", l.precos), fact("Público", l.publico))),
        dobra("O que levar", "backpack", list(l.o_que_levar)),
        dobra("Se chover", "rain", l.clima && l.clima.sensivel_a && l.clima.sensivel_a.length ? el("p", { style: "margin:0" }, el("b", {}, "Sensível a: "), l.clima.sensivel_a.join(", ")) : null, l.clima && l.clima.plano_b ? el("p", { style: "margin:0" }, el("b", {}, "Plano B: "), l.clima.plano_b) : null),
        tr && (tr.distancia_km != null || tr.tempo_ida_min != null || tr.dificuldade) ? dobra("A trilha, segundo os relatos", "mountain", el("dl", { class: "facts2" }, fact("Distância", tr.distancia_km != null ? `${String(tr.distancia_km).replace(".", ",")} km` : null), fact("Tempo de ida", tr.tempo_ida_min != null ? `${tr.tempo_ida_min} min` : null), fact("Dificuldade", tr.dificuldade), fact("Sinalização", tr.sinalizacao))) : null,
        dobra("Dicas", "sparkle", list(l.dicas)),
        dobra("Perto daqui", "compass", perto.length ? el("ul", { class: "perto" }, perto.slice(0, 8).map(x => el("li", {}, ic(CATI[x.o.categoria] || "compass"), el("a", { href: "#lugar-" + x.o.id }, x.o.nome), el("span", { class: "muted" }, dtxt(x.m))))) : null),
        dobra("Ainda a confirmar", "info", list(l.pendencias)),
        dobra("Fontes e confiança", "list", el("p", { class: "muted", style: "margin:0" }, `Confiança: ${l.confianca || "n/d"}${l.verificado_em ? " · verificado em " + l.verificado_em.split("-").reverse().join("/") : ""}.`), l.fontes && l.fontes.length ? el("ul", {}, l.fontes.filter(u => /^https?:/.test(u)).map(u => el("li", {}, el("a", { href: u, target: "_blank", rel: "noopener" }, u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 70))))) : null)),
      aside));
}

/* ---------- mapa geral ---------- */
let mReg = null, mHoje = false, mSel = null;
function renderMapa(v) {
  const base = D.lugares.filter(l => comCoord(l) && l.regiao !== "fora-da-ilha");
  const hojeD = D.dias.find(x => x.id === (diaDe(agora()) || diaSel));
  let ls;
  if (mHoje && hojeD) { ls = []; for (const it of hojeD[modo]) if (it.lugar && P[it.lugar] && comCoord(P[it.lugar]) && !ls.includes(P[it.lugar])) ls.push(P[it.lugar]); }
  else ls = base.filter(l => !mReg || l.regiao === mReg);
  const regs = [...new Set(base.map(l => l.regiao))];
  const bb = (mReg || mHoje) && ls.length ? bboxDe(ls.map(l => [l.coords.lng, l.coords.lat]).concat(BASE ? [[BASE.lng, BASE.lat]] : []), 0.25, 3) : ILHA_BB, W = 560, H = (mReg || mHoje) ? 460 : 820;
  const sel = mSel && P[mSel] ? P[mSel] : null;
  const folha = sel ? el("div", { class: "sheet" }, el("button", { class: "sheet-x", "aria-label": "Fechar", onclick: () => { mSel = null; renderMapa(v); } }, ic("x")),
    el("a", { class: "mini", href: "#lugar-" + sel.id }, el("div", { class: "ph" }, thumb(sel)), el("div", { class: "mini-b" }, el("h4", {}, sel.nome), el("div", { class: "meta" }, el("span", { class: "cat" }, ic(CATI[sel.categoria] || "compass"), CATN[sel.categoria] || sel.categoria), stars(sel), sel.da_lagoa && sel.da_lagoa.tempo_min != null ? el("span", {}, ic("car"), ` ${sel.da_lagoa.tempo_min} min`) : null), el("span", { class: "abre" }, "Ver ficha", ic("ext")))),
    acts(sel)) : null;
  v.replaceChildren(explorarTopo("mapa"),
    el("div", { class: "chips" }, el("button", { class: "chip", "aria-pressed": String(mHoje), onclick: () => { mHoje = !mHoje; mReg = null; renderMapa(v); } }, ic("calendar"), hojeD ? `Só ${hojeD.dow} ${hojeD.num}` : "Hoje"), el("button", { class: "chip", "aria-pressed": String(!mHoje && mReg == null), onclick: () => { mHoje = false; mReg = null; renderMapa(v); } }, ic("map"), "Ilha toda"), regs.map(r => el("button", { class: "chip", "aria-pressed": String(!mHoje && mReg === r), onclick: () => { mHoje = false; mReg = r; renderMapa(v); } }, REG[r] || r))),
    el("p", { class: "muted", style: "margin:6px 0 10px;font-size:14px" }, `${ls.length} lugares · casinha = bairro da casa · verde = trilha com GPX · tracejado = rota estimada`),
    el("div", { class: "mapage" },
      el("div", { class: "mapbox big" }, mapaSvg({ bb, W, H, marcas: ls, trilhas: D.trilhas, selecionado: mSel, rotulos: !!(mReg || mHoje), numeros: mHoje, base: true, onSel: id => { mSel = id; renderMapa(v); }, rotuloAria: "Mapa esquemático da Ilha de Santa Catarina com os lugares do roteiro" })),
      el("ul", { class: "perto mapa-lista" }, ls.slice().sort((a, b) => mHoje ? 0 : a.nome.localeCompare(b.nome, "pt-BR")).map((l, i) => el("li", {}, mHoje ? el("b", { class: "num" }, String(i + 1)) : ic(CATI[l.categoria] || "compass"), el("button", { class: "lnk", onclick: () => { mSel = l.id; renderMapa(v); } }, l.nome))))),
    folha);
}

/* ---------- grupo: votos e pendências ---------- */
function pendItem(p) {
  const c = estadoPend(p.id), done = !!c.feito, cid = "chk-" + p.id;
  const dono = c.dono ? (names[c.dono] ? names[c.dono].name : (c.dono === myId || c.dono === "eu" ? "Você" : "Alguém")) : null;
  const acao = p.acao ? (p.acao.u ? ext(p.acao.u, p.acao.t, "btn", "ext") : el("a", { class: "btn", href: "#lugar-" + p.acao.l }, ic("info"), p.acao.t)) : null;
  return el("li", { class: done ? "done" : "" }, el("input", { type: "checkbox", id: cid, checked: done, disabled: readOnly && mode === "ok", onchange: e => salvarPend(p.id, { feito: e.target.checked, por: myId || "eu" }) }),
    el("div", {}, el("label", { for: cid }, p.titulo), p.detalhe ? el("div", { class: "d" }, p.detalhe) : null,
      el("div", { class: "prow" }, p.prazo ? el("span", { class: "pz" }, ic("clock"), " " + p.prazo) : null, dono ? el("span", { class: "dono" }, ic("check"), ` ${dono} cuida`) : el("button", { class: "lnk", onclick: () => salvarPend(p.id, { dono: myId || "eu" }) }, "Eu cuido disso")),
      acao ? el("div", { class: "acts" }, acao) : null));
}
function renderGrupo(v) {
  const GR = [["agora", "Fazer agora", "bolt"], ["previsao", "Decidir pela previsão", "cloud"], ["aberto", "Em aberto", "info"]];
  const feitos = D.pendencias.filter(p => estadoPend(p.id).feito).length;
  const ranking = D.lugares.map(l => ({ l, s: score(l.id), t: tally(l.id) })).filter(x => x.t[2].length + x.t[1].length + x.t[0].length).sort((a, b) => b.s - a.s).slice(0, 8);
  v.replaceChildren(el("h1", { class: "big-h" }, "Grupo"),
    el("section", { class: "sec" }, el("h2", {}, ic("heart"), "O que o grupo quer"),
      ranking.length ? el("ol", { class: "rank" }, ranking.map(x => el("li", {}, el("a", { href: "#lugar-" + x.l.id }, x.l.nome), el("span", { class: "tv" }, rostos(x.t[2]), ` ${x.t[2].length} bora · ${x.t[1].length} topa · ${x.t[0].length} passa`)))) : el("p", { class: "muted" }, "Ninguém votou ainda. Abra Explorar › Decidir e vote nas praias, pores do sol e noites.")),
    el("p", { class: "muted", style: "margin:0 0 18px" }, `${feitos} de ${D.pendencias.length} pendências resolvidas. Quem pegar uma, toca em "Eu cuido disso".`),
    el("div", { class: "pgrid" }, GR.map(([k, t, i]) => el("section", {}, el("h2", { class: "pg-h" }, ic(i), t), el("ul", { class: "todo" }, D.pendencias.filter(x => x.grupo === k).map(pendItem))))));
}

/* ---------- guia ---------- */
function renderGuia(v, ancora) {
  const g = D.guia, mq = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  const malasFeitas = store.get("floripa-malas", {});
  const s = (id, t, i, ...c) => el("section", { class: "sec", id: "guia-" + id }, el("h2", {}, ic(i), t), c);
  v.replaceChildren(el("h1", { class: "big-h" }, "Guia"),
    el("nav", { class: "chips", "aria-label": "Seções do guia" }, [["hospedagem", "Casa"], ["emergencia", "Emergência"], ["tempo", "Tempo e maré"], ["malas", "Malas"], ["sc21k", "SC21K"], ["dinheiro", "Dinheiro"], ["regras", "Regras"]].map(([a, t]) => el("a", { class: "chip", href: "#guia-" + a }, t))),
    s("hospedagem", "Hospedagem", "pin", el("div", { class: "cards2" }, g.hospedagem.map(h => el("article", { class: "box stk" }, el("h3", {}, h.nome), el("p", { class: "muted", style: "margin:0" }, h.bairro + " · " + h.noites), el("dl", { class: "facts2" }, fact("Check-in", h.checkin), fact("Check-out", h.checkout)), el("p", { class: "tnota" }, ic("info"), h.nota))))),
    s("emergencia", "Emergência", "alert", el("div", { class: "fones" }, g.emergencia.map(e => el("a", { class: "fone stk", href: "tel:" + e.n }, el("b", { class: "mono" }, e.n), el("span", {}, el("strong", {}, e.t), el("small", { class: "muted" }, e.d))))),
      el("p", { class: "tnota" }, ic("info"), "Se a ligação não abrir pelo toque, disque o número."),
      el("h3", { class: "sub" }, "Hospital e pronto-socorro"), el("ul", { class: "perto" }, g.saude.map(x => el("li", {}, ic("alert"), el("a", { href: mq(x.q), target: "_blank", rel: "noopener" }, x.t), el("span", { class: "muted" }, x.d)))),
      el("h3", { class: "sub" }, "Farmácia"), el("ul", { class: "perto" }, g.farmacia.map(x => el("li", {}, ic("pin"), el("a", { href: mq(x.q), target: "_blank", rel: "noopener" }, x.t), el("span", { class: "muted" }, x.d)))),
      el("h3", { class: "sub" }, "Mercado, posto e lavanderia"), el("ul", { class: "perto" }, g.servicos.map(x => el("li", {}, ic("pin"), el("a", { href: mq(x.q), target: "_blank", rel: "noopener" }, x.t), el("span", { class: "muted" }, x.d))))),
    s("tempo", "Tempo e maré", "cloud", el("p", { style: "margin:0" }, ic("sunrise"), " Sol nasce 5h11 · ", ic("sunset"), " se põe 18h50 (sem horário de verão)."), el("div", { class: "grid-apps" }, g.tempo.map(x => ext(x.u, x.t, "btn", "ext"))), el("p", { class: "tnota" }, ic("info"), "Piscinas Naturais só com maré baixa e mar calmo. Com vento sul, o norte da ilha fica melhor; com nordeste, o sul.")),
    s("malas", "O que levar", "backpack", el("p", { class: "muted", style: "margin:0" }, "Marque o que já está na mala. Fica salvo só no seu celular."),
      el("div", { class: "cards2" }, g.malas.map(m => el("article", { class: "box stk" }, el("h3", {}, m.g), el("ul", { class: "checklist malas" }, m.itens.map((it, i) => { const k = m.g + "|" + i; return el("li", {}, el("label", {}, el("input", { type: "checkbox", id: "mala-" + m.g.replace(/\W/g, "") + i, checked: !!malasFeitas[k], onchange: e => { const s2 = store.get("floripa-malas", {}); s2[k] = e.target.checked; store.set("floripa-malas", s2); } }), " ", it)); })))))),
    s("sc21k", "SC21K, dom 29", "run", el("ul", { class: "passos" }, g.sc21k.map((t, i) => el("li", {}, el("span", { class: "n" }, String(i + 1)), el("span", {}, t)))), el("a", { class: "btn", href: "#lugar-sc21k-2026" }, ic("info"), "Ficha da prova")),
    s("dinheiro", "Dinheiro", "ticket", el("div", { class: "tabela-wrap" }, el("table", { class: "tabela" }, el("tbody", {}, g.dinheiro.map(x => el("tr", {}, el("th", {}, x.t), el("td", { class: "mono" }, x.v), el("td", { class: "muted" }, x.d)))))),
      el("p", { class: "tnota" }, ic("info"), "Valores são estimativas da pesquisa de 16 e 17/11. Para rachar: "), el("div", { class: "grid-apps" }, g.rachar.map(x => ext(x.u, x.t, "btn", "ext")))),
    s("regras", "Regras da casa", "checksq", el("div", { class: "rules stk" }, g.regras.map(r => el("p", {}, ic(r.i), el("span", {}, el("b", {}, r.t + ": "), r.d))))));
  if (ancora) requestAnimationFrame(() => { const n = document.getElementById("guia-" + ancora); if (n) n.scrollIntoView(); });
}

/* ---------- rotas ---------- */
let curR = "hoje";
const TABS = [["hoje", "Hoje", "sun"], ["roteiro", "Roteiro", "calendar"], ["lugares", "Explorar", "compass"], ["grupo", "Grupo", "heart"], ["guia", "Guia", "info"]];
const botaoAba = ([r, t, icn]) => el("button", { "data-r": r, onclick: () => { location.hash = r; } }, ic(icn), el("span", {}, t), r === "grupo" ? el("i", { class: "badge", id: "badge-" + r + "-" + Math.random().toString(36).slice(2, 6) }) : null);
$("#tabs-top").replaceChildren(...TABS.map(botaoAba));
$("#bnav").replaceChildren(...TABS.map(botaoAba));
$("#modeseg").replaceChildren(...[["sol", "Sol", "sun"], ["chuva", "Chuva", "rain"], ["cmp", "Comparar sol e chuva", "shuffle"]].map(([m, t, i]) => el("button", { "data-m": m, "aria-pressed": "false", "aria-label": m === "cmp" ? t : "Plano " + t.toLowerCase(), title: m === "cmp" ? t : "Plano " + t.toLowerCase(), onclick: () => setModo(m) }, ic(i), m === "cmp" ? null : el("span", { class: "tl" }, t))));
function route(manter) {
  const h = (location.hash || "#hoje").slice(1);
  let r = "hoje", arg = null;
  if (h.startsWith("lugar-")) { r = "lugar"; arg = h.slice(6); }
  else if (h.startsWith("dia-")) { r = "roteiro"; diaSel = h.slice(4); }
  else if (h.startsWith("decidir")) { r = "decidir"; arg = h.split("-").slice(1).join("-") || null; }
  else if (h.startsWith("guia")) { r = "guia"; arg = h.split("-").slice(1).join("-") || null; }
  else if (["hoje", "roteiro", "lugares", "mapa", "grupo", "pendencias"].includes(h)) r = h === "pendencias" ? "grupo" : h;
  curR = r;
  const vis = { hoje: "hoje", roteiro: "roteiro", lugares: "explorar", decidir: "explorar", mapa: "explorar", lugar: "lugar", grupo: "grupo", guia: "guia" }[r];
  for (const x of ["hoje", "roteiro", "explorar", "grupo", "guia", "lugar"]) $("#v-" + x).hidden = x !== vis;
  const aba = { lugar: "lugares", decidir: "lugares", mapa: "lugares" }[r] || r;
  document.querySelectorAll("#tabs-top button, #bnav button").forEach(t => { if (t.dataset.r === aba) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current"); });
  const urg = D.pendencias.filter(p => p.grupo === "agora" && !estadoPend(p.id).feito).length;
  document.querySelectorAll(".badge").forEach(b => { b.textContent = urg ? String(urg) : ""; b.hidden = !urg; });
  if (r !== "lugar") { $("#fbar").hidden = true; document.body.classList.remove("tem-fbar"); }
  const view = $("#v-" + vis), y = window.scrollY;
  if (r === "hoje") renderHoje(view); else if (r === "roteiro") renderRoteiro(view); else if (r === "lugares") renderLugares(view); else if (r === "decidir") renderDecidir(view, arg); else if (r === "mapa") renderMapa(view); else if (r === "grupo") renderGrupo(view); else if (r === "guia") renderGuia(view, manter ? null : arg); else renderLugar(view, arg);
  if (manter) { view.querySelectorAll(":scope > *").forEach(n => n.style.animation = "none"); window.scrollTo(0, y); }
}
let lastR = null;
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); const so = h.startsWith("dia-") && lastR && lastR.startsWith("dia-"); route(so); if (!so && !h.startsWith("guia-")) window.scrollTo({ top: 0 }); lastR = h; });
applyModo(); route(); initCaps();
// offline: só na versão estática servida por https, fora de iframe (no claude.ai não registra)
if ("serviceWorker" in navigator && location.protocol === "https:" && window.top === window) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
