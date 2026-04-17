const supabaseUrl = 'https://dxboyuqtowwmxhyhcagg.supabase.co';
const supabaseKey = 'sb_publishable_uU43eCEREE8MjE0ajSYL-g_cmY61_bl';
const miSupabase = supabase.createClient(supabaseUrl, supabaseKey);

// ─── 1. CALENDARIO ────────────────────────────────────────────────────────────
const ahora          = new Date();
const añoActual      = ahora.getFullYear();
const mesActual      = ahora.getMonth();
const nombreMes      = ahora.toLocaleString('es-ES', { month: 'long' });
const tituloMes      = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1) + ' ' + añoActual;
const ultimoDiaMes   = new Date(añoActual, mesActual + 1, 0).getDate();
const hoyString      = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

const fechasDelMes = Array.from({ length: ultimoDiaMes }, (_, i) => {
    const d = i + 1;
    return `${añoActual}-${String(mesActual + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
});

// ─── 2. TOAST ────────────────────────────────────────────────────────────────
let toastTimer = null;
function mostrarToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ─── 3. MODAL ────────────────────────────────────────────────────────────────
let _modalUserId = null;

function abrirModal() {
    document.getElementById('modal-input').value = '';
    document.getElementById('modal-overlay').classList.add('show');
    setTimeout(() => document.getElementById('modal-input').focus(), 150);
}

function cerrarModal() {
    document.getElementById('modal-overlay').classList.remove('show');
}

// Cerrar modal al hacer clic fuera
document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) cerrarModal();
});

// Enter dentro del input confirma
document.getElementById('modal-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmarHabito();
});

async function confirmarHabito() {
    const nombre = document.getElementById('modal-input').value.trim();
    if (!nombre) { mostrarToast('Escribe un nombre para el hábito.'); return; }

    const { data: { user } } = await miSupabase.auth.getUser();
    if (!user) return;

    cerrarModal();

    const { error } = await miSupabase
        .from('habito')
        .insert([{ habit_name: nombre, id_usuario: user.id }]);

    if (error) { mostrarToast('Error al crear el hábito.'); return; }

    mostrarToast(`✓ "${nombre}" añadido`);
    cargarTracker(user.id);
}

// ─── 4. SESIÓN ───────────────────────────────────────────────────────────────
miSupabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display  = 'block';
        _modalUserId = session.user.id;
        cargarTracker(session.user.id);
    } else {
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('app-container').style.display  = 'none';
    }
});

async function acceder() {
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorEl  = document.getElementById('auth-error');
    errorEl.textContent = '';

    if (!email || !password) { errorEl.textContent = 'Completa los campos.'; return; }

    const { error } = await miSupabase.auth.signInWithPassword({ email, password });
    if (error) {
        // Si no existe, intentamos registrar
        const { error: regError } = await miSupabase.auth.signUp({ email, password });
        if (regError) errorEl.textContent = regError.message;
        else mostrarToast('Cuenta creada. Revisa tu correo para confirmar.');
    }
}

async function loginConGoogle() {
    await miSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
    });
}

async function cerrarSesion() {
    try {
        await miSupabase.auth.signOut();
    } finally {
        window.location.href = window.location.origin + window.location.pathname;
    }
}

// ─── 5. CARGA DEL TRACKER ────────────────────────────────────────────────────
async function cargarTracker(userId) {
    const container = document.getElementById('grid-container');
    container.style.setProperty('--days', ultimoDiaMes);
    document.getElementById('titulo-app').textContent = `RomaTrack · ${tituloMes}`;

    const [{ data: habitos }, { data: registros }] = await Promise.all([
        miSupabase.from('habito').select('*').eq('id_usuario', userId),
        miSupabase.from('registro_habito').select('*').eq('id_usuario', userId)
    ]);

    // Usamos un DocumentFragment para evitar reflows múltiples
    const frag = document.createDocumentFragment();

    // ── Esquina superior izquierda sticky
    const corner = document.createElement('div');
    corner.className = 'sticky-corner';
    frag.appendChild(corner);

    // ── Cabecera de fechas (con día de la semana)
    fechasDelMes.forEach(fecha => {
        const d     = new Date(fecha + 'T12:00:00'); // hora local, evita desfase UTC
        const dow   = DIAS_SEMANA[d.getDay()];
        const num   = String(d.getDate()).padStart(2, '0');
        const esHoy = fecha === hoyString;

        const celda = document.createElement('div');
        celda.className = 'date-header-cell' + (esHoy ? ' date-today' : '');
        celda.innerHTML = `<span class="date-dow">${dow}</span><span class="date-num">${num}</span>`;
        frag.appendChild(celda);
    });

    // ── Cabecera columna racha
    const rachaHead = document.createElement('div');
    rachaHead.style.cssText = 'font-size:9px;color:var(--text-dim);letter-spacing:2px;text-align:center';
    rachaHead.textContent = 'RACHA';
    frag.appendChild(rachaHead);

    // ── Sin hábitos
    if (!habitos || habitos.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = 'Todavía no hay hábitos.<br>Pulsa <strong>+ Nuevo</strong> para empezar.';
        frag.appendChild(empty);
        container.innerHTML = '';
        container.appendChild(frag);
        document.getElementById('stats-panel').innerHTML = '';
        return;
    }

    // ── Filas de hábitos
    habitos.forEach(habito => {
        // Columna sticky: nombre
        const habitoDiv = document.createElement('div');
        habitoDiv.className = 'habit-container';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'habit-name';
        nameSpan.textContent = habito.habit_name; // textContent evita XSS
        nameSpan.title = habito.habit_name;
        habitoDiv.appendChild(nameSpan);
        frag.appendChild(habitoDiv);

        // Columnas centrales: celdas
        fechasDelMes.forEach(fecha => {
            const cumplido = registros.some(r => r.id_hab === habito.id_hab && r.fecha_cumplido === fecha);
            const futuro   = fecha > hoyString;

            const cell = document.createElement('div');
            cell.className = `cell${cumplido ? ' completed' : ''}${futuro ? ' future' : ''}`;
            cell.dataset.id   = habito.id_hab;
            cell.dataset.date = fecha;
            cell.dataset.done = cumplido ? '1' : '0';
            cell.dataset.user = userId;
            if (!futuro) cell.addEventListener('click', handleToggle);
            frag.appendChild(cell);
        });

        // Columna derecha: racha + borrar
        const racha = calcularRacha(habito.id_hab, registros);
        const streakDiv = document.createElement('div');
        streakDiv.className = 'streak-wrapper';

        const badge = document.createElement('div');
        badge.className = 'streak-badge' + (racha >= 7 ? ' hot' : '');
        badge.textContent = racha;
        badge.title = racha >= 7 ? '🔥 ¡Racha en llamas!' : `${racha} días seguidos`;

        const btnDel = document.createElement('button');
        btnDel.className = 'btn-delete';
        btnDel.textContent = '×';
        btnDel.title = 'Eliminar hábito';
        btnDel.addEventListener('click', () => borrarHabito(habito.id_hab, habito.habit_name, userId));

        streakDiv.appendChild(badge);
        streakDiv.appendChild(btnDel);
        frag.appendChild(streakDiv);
    });

    container.innerHTML = '';
    container.appendChild(frag);

    actualizarEstadisticas(habitos, registros);
}

// ─── 6. TOGGLE (sin recargar toda la página) ─────────────────────────────────
async function handleToggle(e) {
    const cell   = e.currentTarget;
    const idHab  = cell.dataset.id;
    const fecha  = cell.dataset.date;
    const done   = cell.dataset.done === '1';
    const userId = cell.dataset.user;

    // Feedback visual inmediato
    cell.classList.add('loading');

    let ok = false;
    if (done) {
        const { error } = await miSupabase
            .from('registro_habito')
            .delete()
            .match({ id_hab: idHab, fecha_cumplido: fecha, id_usuario: userId });
        ok = !error;
    } else {
        const { error } = await miSupabase
            .from('registro_habito')
            .insert([{ id_hab: idHab, fecha_cumplido: fecha, id_usuario: userId }]);
        ok = !error;
    }

    if (ok) {
        // Actualizar el estado local sin recargar todo
        cell.dataset.done = done ? '0' : '1';
        cell.classList.toggle('completed', !done);
        cell.classList.remove('loading');
        // Recargar para actualizar rachas y stats (ligero)
        cargarTracker(userId);
    } else {
        cell.classList.remove('loading');
        mostrarToast('Error al guardar. Inténtalo de nuevo.');
    }
}

// ─── 7. BORRAR HÁBITO ────────────────────────────────────────────────────────
async function borrarHabito(id, nombre, userId) {
    if (!confirm(`¿Eliminar el hábito "${nombre}" y todos sus registros?`)) return;

    // FIX: borrar también los registros huérfanos
    await Promise.all([
        miSupabase.from('registro_habito').delete().match({ id_hab: id, id_usuario: userId }),
        miSupabase.from('habito').delete().eq('id_hab', id)
    ]);

    mostrarToast(`"${nombre}" eliminado`);
    cargarTracker(userId);
}

// ─── 8. RACHA ────────────────────────────────────────────────────────────────
function calcularRacha(idHab, registros) {
    const set  = new Set(registros.filter(r => r.id_hab === idHab).map(r => r.fecha_cumplido));
    let racha  = 0;
    const base = new Date(hoyString + 'T12:00:00');

    // Si hoy no está marcado, empezamos desde ayer
    if (!set.has(hoyString)) base.setDate(base.getDate() - 1);

    for (let i = 0; i < 366; i++) {
        const f = base.toLocaleDateString('en-CA');
        if (set.has(f)) {
            racha++;
            base.setDate(base.getDate() - 1);
        } else {
            break;
        }
    }
    return racha;
}

// ─── 9. ESTADÍSTICAS ────────────────────────────────────────────────────────
function actualizarEstadisticas(habitos, registros) {
    const statsPanel  = document.getElementById('stats-panel');
    const hoy         = new Date();
    const diaMes      = hoy.getDate();
    const diaSemana   = hoy.getDay() === 0 ? 7 : hoy.getDay(); // lunes=1
    const mesPrefix   = hoyString.substring(0, 7); // YYYY-MM

    // Inicio de la semana (lunes)
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - (diaSemana - 1));
    inicioSemana.setHours(0, 0, 0, 0);

    const frag = document.createDocumentFragment();

    habitos.forEach(habito => {
        const misReg = registros.filter(r => r.id_hab === habito.id_hab);

        // Mensual
        const regMes = misReg.filter(r => r.fecha_cumplido.startsWith(mesPrefix)).length;
        const pctMes = Math.round((regMes / diaMes) * 100);

        // FIX: inicioSemana como Date comparado con Date (no number)
        const regSem = misReg.filter(r => {
            const d = new Date(r.fecha_cumplido + 'T12:00:00');
            return d >= inicioSemana;
        }).length;
        const pctSem = Math.round((regSem / diaSemana) * 100);

        // Total
        let pctTotal = 0;
        if (misReg.length > 0) {
            const fechasOrdenadas = misReg.map(r => r.fecha_cumplido).sort();
            const inicio = new Date(fechasOrdenadas[0] + 'T12:00:00');
            const diasTotales = Math.max(1, Math.ceil((hoy - inicio) / (1000 * 60 * 60 * 24)) + 1);
            pctTotal = Math.round((misReg.length / diasTotales) * 100);
        }

        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <h3 title="${escHtml(habito.habit_name)}">${escHtml(habito.habit_name)}</h3>
            <div class="stat-cols">
                <div class="stat-col">
                    <div class="stat-value">${pctSem}%</div>
                    <div class="stat-label">Semana</div>
                </div>
                <div class="stat-col">
                    <div class="stat-value">${pctMes}%</div>
                    <div class="stat-label">Mes</div>
                </div>
                <div class="stat-col">
                    <div class="stat-value">${pctTotal}%</div>
                    <div class="stat-label">Total</div>
                </div>
            </div>`;
        frag.appendChild(card);
    });

    statsPanel.innerHTML = '';
    statsPanel.appendChild(frag);
}

// ─── 10. UTILIDADES ──────────────────────────────────────────────────────────
function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
