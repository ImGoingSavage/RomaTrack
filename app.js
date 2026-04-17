const supabaseUrl = 'https://dxboyuqtowwmxhyhcagg.supabase.co';
const supabaseKey = 'sb_publishable_uU43eCEREE8MjE0ajSYL-g_cmY61_bl'; 
const miSupabase = supabase.createClient(supabaseUrl, supabaseKey);

// --- LÓGICA DE CALENDARIO ---
const ahora = new Date();
const añoActual = ahora.getFullYear();
const mesActual = ahora.getMonth(); 
const nombreMes = ahora.toLocaleString('es-ES', { month: 'long' });
const tituloMes = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1) + " " + añoActual;
const ultimoDiaMes = new Date(añoActual, mesActual + 1, 0).getDate();

const fechasDelMes = [];
for (let i = 1; i <= ultimoDiaMes; i++) {
    fechasDelMes.push(`${añoActual}-${String(mesActual + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
}

// --- AUTENTICACIÓN ---
miSupabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        cargarTracker(session.user.id);
    } else {
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('app-container').style.display = 'none';
    }
});

async function acceder() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('auth-error');
    if (!email || !password) return errorMsg.innerText = "Completa los campos.";
    
    const { error } = await miSupabase.auth.signInWithPassword({ email, password });
    if (error) {
        const { error: regError } = await miSupabase.auth.signUp({ email, password });
        if (regError) errorMsg.innerText = regError.message;
        else alert("Cuenta creada. Pulsa Entrar.");
    }
}

async function loginConGoogle() {
    await miSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
    });
}

async function cerrarSesion() {
    await miSupabase.auth.signOut();
    window.location.href = window.location.origin + window.location.pathname;
}

// --- TRACKER PRINCIPAL ---
async function cargarTracker(userId) {
    const container = document.getElementById('grid-container');
    const hoyString = new Date().toLocaleDateString('en-CA');
    
    container.style.setProperty('--days', ultimoDiaMes);
    document.getElementById('titulo-app').innerText = `RomaTrack - ${tituloMes}`;

    const { data: habitos } = await miSupabase.from('habito').select('*').eq('id_usuario', userId);
    const { data: registros } = await miSupabase.from('registro_habito').select('*').eq('id_usuario', userId);

    container.innerHTML = "<div class='sticky-header-corner'></div>"; 
    fechasDelMes.forEach(f => container.innerHTML += `<div class="date-label">${f.split('-')[2]}</div>`);
    container.innerHTML += `<div class="date-label">Racha</div>`;

    if (!habitos || habitos.length === 0) {
        container.innerHTML += `<div style="grid-column: 1 / -1; text-align:center; padding:20px; color:#666;">Crea tu primer hábito.</div>`;
        return;
    }

    habitos.forEach(habito => {
        container.innerHTML += `
            <div class="habit-container">
                <span class="habit-name">${habito.habit_name}</span>
                <button class="btn-delete" onclick="borrarHabito('${habito.id_hab}', '${habito.habit_name}', '${userId}')">×</button>
            </div>`;

        fechasDelMes.forEach(fecha => {
            const estaCumplido = registros.some(r => r.id_hab === habito.id_hab && r.fecha_cumplido === fecha);
            const esFuturo = fecha > hoyString;
            const click = esFuturo ? "" : `onclick="toggleHabit('${habito.id_hab}', '${fecha}', ${estaCumplido}, '${userId}')"`;
            container.innerHTML += `
                <div class="cell-wrapper">
                    <span class="cell-date">${fecha.split('-')[2]}</span>
                    <div class="cell ${estaCumplido ? 'completed' : ''} ${esFuturo ? 'future' : ''}" ${click}></div>
                </div>`;
        });

        const racha = calcularRacha(habito.id_hab, registros);
        container.innerHTML += `<div class="streak-badge">${racha}</div>`;
    });

    actualizarEstadisticas(habitos, registros);
}

function actualizarEstadisticas(habitos, registros) {
    const statsPanel = document.getElementById('stats-panel');
    statsPanel.innerHTML = "";
    const hoy = new Date();
    const diaMes = hoy.getDate();
    let diaSemana = hoy.getDay() === 0 ? 7 : hoy.getDay();

    habitos.forEach(habito => {
        const misReg = registros.filter(r => r.id_hab === habito.id_hab);
        const regMes = misReg.filter(r => r.fecha_cumplido.startsWith(hoy.toLocaleDateString('en-CA').substring(0,7))).length;
        const pctMes = ((regMes / diaMes) * 100).toFixed(0);

        const inicioSem = new Date(hoy);
        inicioSem.setDate(hoy.getDate() - (diaSemana - 1));
        const regSem = misReg.filter(r => new Date(r.fecha_cumplido + "T00:00:00") >= inicioSem.setHours(0,0,0,0)).length;
        const pctSem = ((regSem / diaSemana) * 100).toFixed(0);

        let pctTotal = 0;
        if (misReg.length > 0) {
            const inicio = new Date(misReg.map(r => r.fecha_cumplido).sort()[0] + "T00:00:00");
            const diasTotales = Math.ceil((hoy - inicio) / (1000*60*60*24)) || 1;
            pctTotal = ((misReg.length / diasTotales) * 100).toFixed(0);
        }

        statsPanel.innerHTML += `
            <div class="stat-card">
                <h3>${habito.habit_name}</h3>
                <div style="display: flex; justify-content: space-around;">
                    <div><div class="stat-value">${pctSem}%</div><div class="stat-label">Semana</div></div>
                    <div><div class="stat-value">${pctMes}%</div><div class="stat-label">Mes</div></div>
                    <div><div class="stat-value">${pctTotal}%</div><div class="stat-label">Total</div></div>
                </div>
            </div>`;
    });
}

function calcularRacha(idHab, registros) {
    let racha = 0; let b = new Date(); b.setHours(0,0,0,0);
    while (true) {
        const f = b.toLocaleDateString('en-CA');
        if (registros.some(r => r.id_hab === idHab && r.fecha_cumplido === f)) { racha++; b.setDate(b.getDate()-1); }
        else { if (f === new Date().toLocaleDateString('en-CA')) { b.setDate(b.getDate()-1); continue; } break; }
    } return racha;
}

async function borrarHabito(id, nom, user) {
    if (confirm(`¿Borrar ${nom}?`)) { 
        await miSupabase.from('habito').delete().eq('id_hab', id); 
        cargarTracker(user); 
    }
}

async function toggleHabit(id, f, est, user) {
    if (est) await miSupabase.from('registro_habito').delete().match({ id_hab: id, fecha_cumplido: f, id_usuario: user });
    else await miSupabase.from('registro_habito').insert([{ id_hab: id, fecha_cumplido: f, id_usuario: user }]);
    cargarTracker(user);
}

async function crearHabitoReal() {
    const { data: { user } } = await miSupabase.auth.getUser();
    const n = prompt("Hábito:");
    if (n && user) { await miSupabase.from('habito').insert([{ habit_name: n, id_usuario: user.id }]); cargarTracker(user.id); }
}