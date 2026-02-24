import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  writeBatch,
  setDoc,
  getDoc,
  where,
  orderBy
} from "firebase/firestore";
import { db } from "./firebase";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

function App() {
  const [vista, setVista] = useState("dashboard");
  const [balance, setBalance] = useState(0);
  const [importe, setImporte] = useState("");
  const [pagadoPor, setPagadoPor] = useState("mdekot@gmail.com");
  const [comercio, setComercio] = useState("");
  const [gastos, setGastos] = useState([]);

  const [mesActual, setMesActual] = useState(2);
  const [anioActual, setAnioActual] = useState(2026);

  const [gastoEditando, setGastoEditando] = useState(null);
  const [editComercio, setEditComercio] = useState("");
  const [editImporte, setEditImporte] = useState("");
  const [editPagadoPor, setEditPagadoPor] = useState("");

  const [gastoAEliminar, setGastoAEliminar] = useState(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ✅ SOLO MOVIL: selector para elegir supermercado
  const [superMobile, setSuperMobile] = useState("MERCADONA");

  // ===== LISTA COMPRA (4 SUPERS) =====
  const SUPERS = [
    { key: "MERCADONA", defaultName: "MERCADONA" },
    { key: "LIDL", defaultName: "LIDL" },
    { key: "ALCAMPO", defaultName: "ALCAMPO" },
    { key: "CARREFOUR", defaultName: "CARREFOUR" }
  ];

  const [productos, setProductos] = useState([]);

  const [inputsSuper, setInputsSuper] = useState({
    MERCADONA: "",
    LIDL: "",
    ALCAMPO: "",
    CARREFOUR: ""
  });

  const [productoEditando, setProductoEditando] = useState(null);
  const [editProductoNombre, setEditProductoNombre] = useState("");
  const [productoAEliminar, setProductoAEliminar] = useState(null);

  const [limpiarCompradosConfirm, setLimpiarCompradosConfirm] = useState({
    open: false,
    superKey: null
  });

  const [nombresSupers, setNombresSupers] = useState({
    MERCADONA: "MERCADONA",
    LIDL: "LIDL",
    ALCAMPO: "ALCAMPO",
    CARREFOUR: "CARREFOUR"
  });

  const [superEditando, setSuperEditando] = useState(null);
  const [editSuperNombre, setEditSuperNombre] = useState("");

  // ===== LIQUIDACIÓN =====
  const [liquidarConfirmOpen, setLiquidarConfirmOpen] = useState(false);
  // estadoDeuda: null | "paid" | "unpaid"
  const [estadoDeuda, setEstadoDeuda] = useState(null);

  // ✅ Guardamos también lo que viene de Firestore para comparar con la deuda actual
  const [liquidacionGuardada, setLiquidacionGuardada] = useState(null); // { status, debtor, creditor, amount }

  // ===== CALENDARIO =====
  const hoy = new Date();
  const [calMes, setCalMes] = useState(hoy.getMonth() + 1);
  const [calAnio, setCalAnio] = useState(hoy.getFullYear());
  const [eventos, setEventos] = useState([]);

  const [eventoNuevoOpen, setEventoNuevoOpen] = useState(false);
  const [eventoEditando, setEventoEditando] = useState(null);
  const [eventoAEliminar, setEventoAEliminar] = useState(null);

  const [evTitulo, setEvTitulo] = useState("");
  const [evTipo, setEvTipo] = useState("CUMPLEAÑOS");
  const [evFecha, setEvFecha] = useState("");
  const [evHora, setEvHora] = useState("00:00"); // ✅ para que en móvil se vea 00:00
  const [evNotas, setEvNotas] = useState("");

  // ✅ NUEVO: modal de detalle del día (Google Calendar style)
  const [diaDetalleOpen, setDiaDetalleOpen] = useState(false);
  const [diaDetalleFecha, setDiaDetalleFecha] = useState("");

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre"
  ];

  const formatearComercio = (texto) => {
    if (!texto) return "";
    return texto
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  };

  const COLORES_GRAFICO = [
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#a855f7",
    "#06b6d4"
  ];

  // ✅ Color dinámico para evitar repeticiones cuando haya más comercios que colores base
  const generarColorGrafico = (index, total) => {
    if (index < COLORES_GRAFICO.length) return COLORES_GRAFICO[index];
    const offset = index - COLORES_GRAFICO.length;
    const totalExtra = Math.max(total - COLORES_GRAFICO.length, 1);
    const hue = Math.round((offset * 360) / totalExtra);
    return `hsl(${hue}, 68%, 56%)`;
  };

  const getDebtInfo = (bal) => {
    if (bal > 0) return { debtorName: "Jessica", creditorName: "Mirko", amount: bal };
    if (bal < 0) return { debtorName: "Mirko", creditorName: "Jessica", amount: Math.abs(bal) };
    return { debtorName: "", creditorName: "", amount: 0 };
  };

  const idLiquidacion = `${anioActual}-${String(mesActual).padStart(2, "0")}`;

  // ===== GASTOS (TIEMPO REAL) =====
  useEffect(() => {
    const q = query(collection(db, "gastos"));
    const unsub = onSnapshot(q, (snapshot) => {
      let totalPagado = 0;
      let totalDebe = 0;
      let lista = [];

      snapshot.forEach((documento) => {
        const data = documento.data();

        if (data.mes === mesActual && data.anio === anioActual && data.liquidado === false) {
          lista.push({ id: documento.id, ...data });

          const parte = data.importe / data.participantesCount;

          if (data.pagadoPor === "mdekot@gmail.com") {
            totalPagado += data.importe;
            totalDebe += parte;
          } else {
            totalDebe += parte;
          }
        }
      });

      lista.sort((a, b) => {
        if (!a.fecha || !b.fecha) return 0;
        return b.fecha.seconds - a.fecha.seconds;
      });

      setGastos(lista);
      setBalance(totalPagado - totalDebe);
    });

    return () => unsub();
  }, [mesActual, anioActual]);

  // ===== CARGAR ESTADO DE LIQUIDACIÓN POR MES/AÑO =====
  useEffect(() => {
    const cargarEstadoLiquidacion = async () => {
      try {
        const ref = doc(db, "liquidaciones", idLiquidacion);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() || {};
          setLiquidacionGuardada({
            status: data.status || null,
            debtor: data.debtor || "",
            creditor: data.creditor || "",
            amount: typeof data.amount === "number" ? data.amount : 0
          });
        } else {
          setLiquidacionGuardada(null);
        }
      } catch (e) {
        console.error(e);
        setLiquidacionGuardada(null);
      }
    };
    cargarEstadoLiquidacion();
  }, [idLiquidacion]);

  // ✅ CLAVE: si la deuda actual no coincide con la guardada, NO mostramos paid/unpaid
  useEffect(() => {
    if (balance === 0) {
      setEstadoDeuda(null);
      return;
    }

    if (!liquidacionGuardada || !liquidacionGuardada.status) {
      setEstadoDeuda(null);
      return;
    }

    const actual = getDebtInfo(balance);

    const mismoDeudor = (liquidacionGuardada.debtor || "") === actual.debtorName;
    const mismoAcreedor = (liquidacionGuardada.creditor || "") === actual.creditorName;

    const actualAmount2 = Number(actual.amount.toFixed(2));
    const guardadoAmount2 = Number(Number(liquidacionGuardada.amount || 0).toFixed(2));
    const mismoImporte = actualAmount2 === guardadoAmount2;

    if (mismoDeudor && mismoAcreedor && mismoImporte) setEstadoDeuda(liquidacionGuardada.status);
    else setEstadoDeuda(null);
  }, [balance, liquidacionGuardada]);

  // ===== NOMBRES SUPERS (FIRESTORE CONFIG) =====
  useEffect(() => {
    const cargarNombres = async () => {
      try {
        const ref = doc(db, "config", "supers");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() || {};
          const merged = { ...nombresSupers };
          SUPERS.forEach((s) => {
            merged[s.key] = data[s.key] || s.defaultName;
          });
          setNombresSupers(merged);
        } else {
          const defaults = {};
          SUPERS.forEach((s) => (defaults[s.key] = s.defaultName));
          setNombresSupers(defaults);
        }
      } catch (e) {
        console.error(e);
      }
    };
    cargarNombres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirEditarSuper = (superKey) => {
    setSuperEditando(superKey);
    setEditSuperNombre(nombresSupers[superKey] || superKey);
  };

  const guardarNombreSuper = async () => {
    if (!superEditando) return;
    const nuevo = (editSuperNombre || "").trim();
    if (!nuevo) return;

    const updated = { ...nombresSupers, [superEditando]: nuevo };
    setNombresSupers(updated);

    try {
      await setDoc(doc(db, "config", "supers"), { [superEditando]: nuevo }, { merge: true });
    } catch (e) {
      console.error(e);
    }

    setSuperEditando(null);
    setEditSuperNombre("");
  };

  // ===== LISTA COMPRA (TIEMPO REAL) =====
  useEffect(() => {
    const q = query(collection(db, "listaCompra"));
    const unsub = onSnapshot(q, (snapshot) => {
      let lista = [];
      snapshot.forEach((docu) => lista.push({ id: docu.id, ...docu.data() }));
      setProductos(lista);
    });
    return () => unsub();
  }, []);

  const setInputSuper = (superKey, value) => {
    setInputsSuper((prev) => ({ ...prev, [superKey]: value }));
  };

  const agregarProducto = async (superKey) => {
    const texto = (inputsSuper[superKey] || "").trim();
    if (!texto) return;

    await addDoc(collection(db, "listaCompra"), {
      nombre: texto,
      comprado: false,
      fecha: new Date(),
      super: superKey
    });

    setInputSuper(superKey, "");
  };

  const toggleComprado = async (producto) => {
    await updateDoc(doc(db, "listaCompra", producto.id), { comprado: !producto.comprado });
  };

  const confirmarEliminarProducto = async () => {
    if (!productoAEliminar) return;
    await deleteDoc(doc(db, "listaCompra", productoAEliminar.id));
    setProductoAEliminar(null);
  };

  const guardarEdicionProducto = async () => {
    if (!productoEditando) return;
    await updateDoc(doc(db, "listaCompra", productoEditando.id), { nombre: editProductoNombre });
    setProductoEditando(null);
  };

  const limpiarComprados = (superKey) => {
    const comprados = productos.filter((p) => (p.super || "MERCADONA") === superKey && p.comprado);
    if (comprados.length === 0) return;
    setLimpiarCompradosConfirm({ open: true, superKey });
  };

  const confirmarLimpiarComprados = async () => {
    const superKey = limpiarCompradosConfirm.superKey;
    if (!superKey) {
      setLimpiarCompradosConfirm({ open: false, superKey: null });
      return;
    }

    const comprados = productos.filter((p) => (p.super || "MERCADONA") === superKey && p.comprado);
    if (comprados.length === 0) {
      setLimpiarCompradosConfirm({ open: false, superKey: null });
      return;
    }

    const batch = writeBatch(db);
    comprados.forEach((p) => batch.delete(doc(db, "listaCompra", p.id)));
    await batch.commit();
    setLimpiarCompradosConfirm({ open: false, superKey: null });
  };

  const productosOrdenadosPorSuper = (superKey) => {
    return productos
      .filter((p) => (p.super || "MERCADONA") === superKey)
      .sort((a, b) => {
        const aC = a.comprado ? 1 : 0;
        const bC = b.comprado ? 1 : 0;
        if (aC !== bC) return aC - bC;
        return (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0);
      });
  };

  const totalCompradosSuper = (superKey) =>
    productos.filter((p) => (p.super || "MERCADONA") === superKey && p.comprado).length;

  const totalPendientesSuper = (superKey) =>
    productos.filter((p) => (p.super || "MERCADONA") === superKey && !p.comprado).length;

  // ===== GASTOS =====
  const agregarGasto = async () => {
    if (!importe || !comercio) return;

    await addDoc(collection(db, "gastos"), {
      importe: Number(importe),
      pagadoPor,
      mes: mesActual,
      anio: anioActual,
      liquidado: false,
      divididoEntre: ["mdekot@gmail.com", "jessica.alca87@gmail.com"],
      participantesCount: 2,
      comercio: formatearComercio(comercio),
      fecha: new Date()
    });

    setImporte("");
    setComercio("");
  };

  const confirmarEliminar = async () => {
    await deleteDoc(doc(db, "gastos", gastoAEliminar.id));
    setGastoAEliminar(null);
  };

  const abrirModalEditar = (gasto) => {
    setGastoEditando(gasto);
    setEditComercio(gasto.comercio);
    setEditImporte(gasto.importe);
    setEditPagadoPor(gasto.pagadoPor);
  };

  const guardarEdicion = async () => {
    await updateDoc(doc(db, "gastos", gastoEditando.id), {
      comercio: formatearComercio(editComercio),
      importe: Number(editImporte),
      pagadoPor: editPagadoPor
    });
    setGastoEditando(null);
  };

  // ===== LIQUIDAR MES (NO BORRA NADA) =====
  const liquidarMes = () => {
    if (balance === 0) return;
    setLiquidarConfirmOpen(true);
  };

  const guardarEstadoLiquidacion = async (status) => {
    const info = getDebtInfo(balance);
    if (!info.debtorName || info.amount === 0) {
      setEstadoDeuda(null);
      setLiquidacionGuardada(null);
      setLiquidarConfirmOpen(false);
      return;
    }

    setEstadoDeuda(status);

    setLiquidacionGuardada({
      status,
      debtor: info.debtorName,
      creditor: info.creditorName,
      amount: Number(Number(info.amount).toFixed(2))
    });

    try {
      await setDoc(
        doc(db, "liquidaciones", idLiquidacion),
        {
          status,
          mes: mesActual,
          anio: anioActual,
          debtor: info.debtorName,
          creditor: info.creditorName,
          amount: Number(Number(info.amount).toFixed(2)),
          updatedAt: new Date()
        },
        { merge: true }
      );
    } catch (e) {
      console.error(e);
    }

    setLiquidarConfirmOpen(false);
  };

  // ===== CALENDARIO (TIEMPO REAL POR MES) =====
  const pad2 = (n) => String(n).padStart(2, "0");
  const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

  const getMonthRange = (y, m) => {
    const start = `${y}-${pad2(m)}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${pad2(m)}-${pad2(lastDay)}`;
    return { start, end, lastDay };
  };

  // ✅ CORREGIDO: consulta SIN índice (quitamos orderBy("hora"))
  useEffect(() => {
    const { start, end } = getMonthRange(calAnio, calMes);

    const qEv = query(
      collection(db, "eventos"),
      where("fecha", ">=", start),
      where("fecha", "<=", end),
      orderBy("fecha", "asc")
    );

    const unsub = onSnapshot(
      qEv,
      (snapshot) => {
        let lista = [];
        snapshot.forEach((docu) => lista.push({ id: docu.id, ...docu.data() }));

        // ✅ Ordenamos en JS por fecha + hora (sin necesitar índice)
        lista.sort((a, b) => {
          const fa = a.fecha || "";
          const fb = b.fecha || "";
          if (fa !== fb) return fa.localeCompare(fb);
          const ha = a.hora || "99:99";
          const hb = b.hora || "99:99";
          return ha.localeCompare(hb);
        });

        setEventos(lista);
      },
      (err) => {
        console.error("Calendario snapshot error:", err);
        setEventos([]);
      }
    );

    return () => unsub();
  }, [calMes, calAnio]);

  const abrirNuevoEvento = (fechaPreseleccionada) => {
    setEvTitulo("");
    setEvTipo("CUMPLEAÑOS");
    setEvNotas("");
    setEvHora("00:00");
    setEvFecha(fechaPreseleccionada || ymd(calAnio, calMes, new Date().getDate()));
    setEventoNuevoOpen(true);
  };

  const guardarNuevoEvento = async () => {
    const t = (evTitulo || "").trim();
    const f = (evFecha || "").trim();
    if (!t || !f) return;

    const horaFinal = (evHora || "").trim() || "00:00";

    await addDoc(collection(db, "eventos"), {
      titulo: t,
      tipo: (evTipo || "OTRO").trim(),
      fecha: f, // YYYY-MM-DD
      hora: horaFinal,
      notas: (evNotas || "").trim(),
      createdAt: new Date()
    });

    setEventoNuevoOpen(false);
  };

  const abrirEditarEvento = (ev) => {
    setEventoEditando(ev);
    setEvTitulo(ev.titulo || "");
    setEvTipo(ev.tipo || "OTRO");
    setEvFecha(ev.fecha || "");
    setEvHora(ev.hora && ev.hora.trim() ? ev.hora : "00:00");
    setEvNotas(ev.notas || "");
  };

  const guardarEdicionEvento = async () => {
    if (!eventoEditando) return;
    const t = (evTitulo || "").trim();
    const f = (evFecha || "").trim();
    if (!t || !f) return;

    const horaFinal = (evHora || "").trim() || "00:00";

    await updateDoc(doc(db, "eventos", eventoEditando.id), {
      titulo: t,
      tipo: (evTipo || "OTRO").trim(),
      fecha: f,
      hora: horaFinal,
      notas: (evNotas || "").trim(),
      updatedAt: new Date()
    });

    setEventoEditando(null);
  };

  const confirmarEliminarEvento = async () => {
    if (!eventoAEliminar) return;
    await deleteDoc(doc(db, "eventos", eventoAEliminar.id));
    setEventoAEliminar(null);
  };

  const tipoColor = (tipo) => {
    const t = (tipo || "").toUpperCase();
    if (t.includes("CUMPLE")) return "#a855f7";
    if (t.includes("MÉD") || t.includes("MED")) return "#ef4444";
    if (t.includes("CITA")) return "#3b82f6";
    if (t.includes("TRABA")) return "#f59e0b";
    return "#22c55e";
  };

  // ✅ Colores rotativos para eventos dentro del mismo día (independiente del tipo)
  const COLORES_EVENTOS_DIA = useMemo(
    () => ["#a855f7", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"],
    []
  );

  const colorEventoPorIndice = (idx) => COLORES_EVENTOS_DIA[idx % COLORES_EVENTOS_DIA.length];

  const eventosPorFecha = {};
  eventos.forEach((ev) => {
    const f = ev.fecha || "";
    if (!eventosPorFecha[f]) eventosPorFecha[f] = [];
    eventosPorFecha[f].push(ev);
  });

  Object.keys(eventosPorFecha).forEach((f) => {
    eventosPorFecha[f].sort((a, b) => (a.hora || "99:99").localeCompare(b.hora || "99:99"));
  });

  const abrirDetalleDia = (fechaStr) => {
    setDiaDetalleFecha(fechaStr);
    setDiaDetalleOpen(true);
  };

  const eventosDelDiaDetalle = (diaDetalleFecha && eventosPorFecha[diaDetalleFecha]) ? eventosPorFecha[diaDetalleFecha] : [];

  const irMesAnterior = () => {
    let m = calMes - 1;
    let y = calAnio;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setCalMes(m);
    setCalAnio(y);
  };

  const irMesSiguiente = () => {
    let m = calMes + 1;
    let y = calAnio;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setCalMes(m);
    setCalAnio(y);
  };

  const irHoy = () => {
    const now = new Date();
    setCalMes(now.getMonth() + 1);
    setCalAnio(now.getFullYear());
  };

  const resumenComercio = {};
  gastos.forEach((g) => {
    if (!resumenComercio[g.comercio]) resumenComercio[g.comercio] = 0;
    resumenComercio[g.comercio] += g.importe;
  });

  const dataGraficoBase = Object.entries(resumenComercio)
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  const dataGrafico = dataGraficoBase.map((item, index) => ({
    ...item,
    color: generarColorGrafico(index, dataGraficoBase.length)
  }));

  const dataGraficoOrdenado = dataGrafico.slice().sort((a, b) => b.total - a.total);

  let totalMirko = 0;
  let totalJessica = 0;

  gastos.forEach((g) => {
    if (g.pagadoPor === "mdekot@gmail.com") totalMirko += g.importe;
    else totalJessica += g.importe;
  });

  const totalMes = totalMirko + totalJessica;

  const debtInfo = getDebtInfo(balance);

  const getBalanceCardStyle = () => {
    if (balance === 0) return styles.balanceCard;
    if (estadoDeuda === "paid") return { ...styles.balanceCard, ...styles.balanceCardPaid };
    if (estadoDeuda === "unpaid") return { ...styles.balanceCard, ...styles.balanceCardUnpaid };
    return styles.balanceCard;
  };

  const renderBalanceText = () => {
    if (balance === 0) return <h2>⚖️ Estáis en empate</h2>;

    if (estadoDeuda === "paid") {
      return (
        <h2 style={styles.balanceCardBigText}>
          {`${debtInfo.debtorName} HA PAGADO LA DEUDA DE ${debtInfo.amount.toFixed(2)} €`}
        </h2>
      );
    }

    if (estadoDeuda === "unpaid") {
      return (
        <h2 style={styles.balanceCardBigText}>
          {`${debtInfo.debtorName} NO HA PAGADO LA DEUDA DE ${debtInfo.amount.toFixed(2)} €`}
        </h2>
      );
    }

    if (balance > 0) return <h2>Jessica debe {balance.toFixed(2)} € a Mirko</h2>;
    return <h2>Mirko debe {Math.abs(balance).toFixed(2)} € a Jessica</h2>;
  };

  // ✅ Mejora visual donut móvil/PC
  const chartHeight = isMobile ? 320 : 440;
  const innerRadius = isMobile ? 62 : 96;
  const outerRadius = isMobile ? 102 : 148;
  const centerHoleRadius = innerRadius - 10;
  const centerMainFont = isMobile ? 18 : 24;
  const centerSubFont = isMobile ? 12 : 14;

  // ===== CALENDARIO UI HELPERS =====
  const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const { lastDay } = getMonthRange(calAnio, calMes);

  const firstDowNative = new Date(calAnio, calMes - 1, 1).getDay(); // 0=Dom..6=Sáb
  const firstDowMonday0 = (firstDowNative + 6) % 7; // 0=Lun..6=Dom
  const totalCeldas = Math.ceil((firstDowMonday0 + lastDay) / 7) * 7;

  const buildCalendarCells = () => {
    const celdas = [];
    for (let i = 0; i < totalCeldas; i++) {
      const dayNum = i - firstDowMonday0 + 1;
      if (dayNum < 1 || dayNum > lastDay) {
        celdas.push({ empty: true, key: `e-${i}` });
      } else {
        const fechaStr = ymd(calAnio, calMes, dayNum);
        const esHoy =
          fechaStr ===
          ymd(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
        celdas.push({ empty: false, key: fechaStr, dayNum, fechaStr, esHoy });
      }
    }
    return celdas;
  };

  const calendarCells = buildCalendarCells();

  return (
    <div style={{ ...styles.container, padding: isMobile ? "16px" : "40px" }}>
      <div style={styles.tabs}>
        <button
          onClick={() => setVista("dashboard")}
          style={vista === "dashboard" ? styles.tabActive : styles.tab}
        >
          Dashboard
        </button>
        <button
          onClick={() => setVista("grafico")}
          style={vista === "grafico" ? styles.tabActive : styles.tab}
        >
          Gráfico Mensual
        </button>
        <button
          onClick={() => setVista("lista")}
          style={vista === "lista" ? styles.tabActive : styles.tab}
        >
          Lista de la Compra
        </button>
        <button
          onClick={() => setVista("calendario")}
          style={vista === "calendario" ? styles.tabActive : styles.tab}
        >
          Calendario
        </button>
      </div>

      {/* ===== CALENDARIO ===== */}
      {vista === "calendario" && (
        <>
          <h1 style={styles.title}>📅 CALENDARIO</h1>

          {/* ✅ móvil: contenedor a pantalla completa sin “fondo claro” */}
          <div
            style={{
              ...styles.calendarPageWrap,
              ...(isMobile ? styles.calendarPageWrapMobile : {})
            }}
          >
            <div style={{ ...styles.cardFull, padding: isMobile ? "14px 12px" : "18px", marginBottom: isMobile ? "14px" : "30px" }}>
              <div
                style={{
                  ...styles.calHeader,
                  flexDirection: isMobile ? "column" : "row",
                  gap: isMobile ? "10px" : "12px"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flexWrap: "wrap",
                    justifyContent: "center"
                  }}
                >
                  <button onClick={irMesAnterior} style={styles.button}>
                    ◀
                  </button>
                  <button onClick={irHoy} style={styles.button}>
                    Hoy
                  </button>
                  <button onClick={irMesSiguiente} style={styles.button}>
                    ▶
                  </button>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <select
                      value={calMes}
                      onChange={(e) => setCalMes(Number(e.target.value))}
                      style={styles.select}
                    >
                      {meses.map((m, idx) => (
                        <option key={m} value={idx + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={calAnio}
                      onChange={(e) => setCalAnio(Number(e.target.value))}
                      style={styles.select}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button
                    onClick={() => abrirNuevoEvento(ymd(calAnio, calMes, 1))}
                    style={styles.buttonAddCalendar}
                  >
                    + Nuevo evento
                  </button>
                </div>
              </div>
            </div>

            {/* ✅ Cuadrícula: sin scroll horizontal, ocupa todo el ancho */}
            <div
              style={{
                ...styles.calendarCard,
                ...(isMobile ? styles.calendarCardMobile : {})
              }}
            >
              <div style={styles.calWeekHeaderUnified}>
                {diasSemana.map((d) => (
                  <div key={d} style={styles.calWeekHeaderCellUnified}>
                    {d}
                  </div>
                ))}
              </div>

              <div style={styles.calGridUnified}>
                {calendarCells.map((c) => {
                  const baseCellStyle = isMobile ? styles.calCellMobile2 : styles.calCell;

                  if (c.empty) {
                    return <div key={c.key} style={{ ...baseCellStyle, ...styles.calCellEmpty }} />;
                  }

                  const evs = eventosPorFecha[c.fechaStr] || [];
                  const cap = isMobile ? 2 : 4;

                  return (
                    <div
                      key={c.key}
                      style={{
                        ...baseCellStyle,
                        ...(c.esHoy ? styles.calCellToday : {})
                      }}
                      onClick={() => abrirDetalleDia(c.fechaStr)}
                      title="Click para ver el día"
                    >
                      <div style={styles.calCellTopRow}>
                        <span
                          style={{
                            ...styles.calDayNumber,
                            ...(c.esHoy ? styles.calDayNumberToday : {})
                          }}
                        >
                          {c.dayNum}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirNuevoEvento(c.fechaStr);
                          }}
                          style={isMobile ? styles.calAddMiniMobile2 : styles.calAddMini}
                          title="Añadir evento"
                        >
                          +
                        </button>
                      </div>

                      <div style={styles.calEventsBox}>
                        {evs.slice(0, cap).map((ev, idx) => (
                          <div
                            key={ev.id}
                            style={{
                              ...styles.eventChip,
                              ...(isMobile ? styles.eventChipMobile2 : {}),
                              background: colorEventoPorIndice(idx) // ✅ colores distintos en el mismo día
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirEditarEvento(ev);
                            }}
                            title={ev.titulo}
                          >
                            {/* ✅ NO mostrar hora en el cuadro del día */}
                            {ev.titulo}
                          </div>
                        ))}

                        {evs.length > cap ? (
                          <div style={styles.moreEvents}>+{evs.length - cap} más</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isMobile && (
                <div style={{ marginTop: "12px", opacity: 0.8, fontSize: "13px" }}>
                  Tip: click en un día para ver detalle. Click en un evento para editar.
                </div>
              )}
            </div>
          </div>

          {/* ✅ DETALLE DEL DÍA (modal tipo Google Calendar) */}
          {diaDetalleOpen && (
            <div style={styles.modalOverlay}>
              <div style={{ ...styles.modal, maxWidth: "420px" }}>
                <h3 style={{ marginTop: 0 }}>📌 {diaDetalleFecha ? new Date(diaDetalleFecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" }) : "Día"}</h3>

                <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
                  <button onClick={() => abrirNuevoEvento(diaDetalleFecha)} style={styles.buttonAddCalendar}>
                    + Añadir evento a este día
                  </button>
                </div>

                {eventosDelDiaDetalle.length === 0 ? (
                  <p>No hay eventos este día</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {eventosDelDiaDetalle.map((ev, idx) => (
                      <div
                        key={ev.id}
                        style={{
                          ...styles.dayDetailRow,
                          borderLeft: `10px solid ${colorEventoPorIndice(idx)}`
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 900, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {ev.titulo}
                            </div>
                            <div style={{ opacity: 0.9, fontSize: "13px", textAlign: "left" }}>
                              {ev.hora ? `${ev.hora}` : "00:00"} · {ev.tipo || "OTRO"}
                            </div>
                            {ev.notas ? (
                              <div style={{ opacity: 0.9, fontSize: "13px", textAlign: "left", marginTop: "6px" }}>
                                {ev.notas}
                              </div>
                            ) : null}
                          </div>

                          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                            <button onClick={() => abrirEditarEvento(ev)} style={styles.buttonEdit}>✏</button>
                            <button onClick={() => setEventoAEliminar(ev)} style={styles.buttonDelete}>🗑</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "14px" }}>
                  <button onClick={() => setDiaDetalleOpen(false)} style={styles.button}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===== MODALES EVENTO (igual que antes) ===== */}
          {eventoNuevoOpen && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>📌 Nuevo Evento</h3>
                <input
                  value={evTitulo}
                  onChange={(e) => setEvTitulo(e.target.value)}
                  style={styles.input}
                  placeholder="Título (ej: Cumpleaños mamá)"
                />
                <select value={evTipo} onChange={(e) => setEvTipo(e.target.value)} style={styles.input}>
                  <option value="CUMPLEAÑOS">Cumpleaños</option>
                  <option value="CITA">Cita</option>
                  <option value="MÉDICO">Médico</option>
                  <option value="TRABAJO">Trabajo</option>
                  <option value="OTRO">Otro</option>
                </select>
                <input type="date" value={evFecha} onChange={(e) => setEvFecha(e.target.value)} style={styles.input} />
                <input
                  type="time"
                  value={evHora}
                  onChange={(e) => setEvHora(e.target.value || "00:00")}
                  style={styles.input}
                />
                <input value={evNotas} onChange={(e) => setEvNotas(e.target.value)} style={styles.input} placeholder="Notas (opcional)" />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                  <button onClick={() => setEventoNuevoOpen(false)} style={styles.button}>
                    Cancelar
                  </button>
                  <button onClick={guardarNuevoEvento} style={styles.buttonPaid}>
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          )}

          {eventoEditando && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>✏ Editar Evento</h3>
                <input value={evTitulo} onChange={(e) => setEvTitulo(e.target.value)} style={styles.input} placeholder="Título" />
                <select value={evTipo} onChange={(e) => setEvTipo(e.target.value)} style={styles.input}>
                  <option value="CUMPLEAÑOS">Cumpleaños</option>
                  <option value="CITA">Cita</option>
                  <option value="MÉDICO">Médico</option>
                  <option value="TRABAJO">Trabajo</option>
                  <option value="OTRO">Otro</option>
                </select>
                <input type="date" value={evFecha} onChange={(e) => setEvFecha(e.target.value)} style={styles.input} />
                <input
                  type="time"
                  value={evHora}
                  onChange={(e) => setEvHora(e.target.value || "00:00")}
                  style={styles.input}
                />
                <input value={evNotas} onChange={(e) => setEvNotas(e.target.value)} style={styles.input} placeholder="Notas (opcional)" />

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", gap: "10px" }}>
                  <button onClick={() => setEventoEditando(null)} style={styles.button}>
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      setEventoAEliminar(eventoEditando);
                      setEventoEditando(null);
                    }}
                    style={styles.buttonDanger}
                  >
                    Eliminar
                  </button>
                  <button onClick={guardarEdicionEvento} style={styles.buttonPaid}>
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          )}

          {eventoAEliminar && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>🗑 Confirmar eliminación</h3>
                <p style={{ marginBottom: "20px" }}>¿Eliminar "{eventoAEliminar.titulo}"?</p>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setEventoAEliminar(null)} style={styles.button}>
                    Cancelar
                  </button>
                  <button onClick={confirmarEliminarEvento} style={styles.buttonDanger}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== LISTA COMPRA ===== */}
      {vista === "lista" && (
        <>
          <h1 style={styles.title}>🛒 LISTA DE LA COMPRA</h1>

          {isMobile ? (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
                <select value={superMobile} onChange={(e) => setSuperMobile(e.target.value)} style={styles.select}>
                  {SUPERS.map((s) => {
                    const nombreVisible = nombresSupers[s.key] || s.defaultName;
                    const pendientes = totalPendientesSuper(s.key);
                    return (
                      <option key={s.key} value={s.key}>
                        {nombreVisible} ({pendientes})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ ...styles.grid, gridTemplateColumns: "1fr", width: "100%", maxWidth: "100%", margin: "0 auto 30px auto" }}>
                {SUPERS.filter((s) => s.key === superMobile).map((s) => {
                  const lista = productosOrdenadosPorSuper(s.key);
                  const nombreVisible = nombresSupers[s.key] || s.defaultName;
                  const totalComprados = totalCompradosSuper(s.key);

                  return (
                    <div key={s.key} style={{ ...styles.card, padding: "16px 12px", margin: "0 auto" }}>
                      <div style={styles.cardHeaderRow}>
                        <h3 style={styles.cardTitle}>· {nombreVisible} ·</h3>
                        <button onClick={() => abrirEditarSuper(s.key)} style={styles.buttonSuperEdit} title="Renombrar supermercado">
                          ✎
                        </button>
                      </div>

                      <div style={styles.superFormRow}>
                        <input
                          type="text"
                          placeholder="Añadir producto..."
                          value={inputsSuper[s.key] || ""}
                          onChange={(e) => setInputSuper(s.key, e.target.value)}
                          style={{ ...styles.inputSuper, width: "100%", maxWidth: "none", minWidth: 0 }}
                        />
                        <button onClick={() => agregarProducto(s.key)} style={styles.buttonAddInline}>
                          Añadir
                        </button>
                      </div>

                      {lista.length === 0 && <p>No hay productos</p>}

                      {lista.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            ...styles.gastoItem,
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "nowrap"
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              opacity: p.comprado ? 0.55 : 1,
                              flex: 1,
                              minWidth: 0
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={p.comprado}
                              onChange={() => toggleComprado(p)}
                              style={{ accentColor: "#22c55e", flexShrink: 0 }}
                            />
                            <span
                              title={p.nombre}
                              style={{
                                textDecoration: p.comprado ? "line-through" : "none",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                minWidth: 0,
                                flex: 1,
                                textAlign: "left",
                                fontSize: "14px",
                                lineHeight: 1.2
                              }}
                            >
                              {p.nombre}
                            </span>
                          </div>

                          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                            <button
                              onClick={() => {
                                setProductoEditando(p);
                                setEditProductoNombre(p.nombre);
                              }}
                              style={{ ...styles.buttonEdit, marginRight: 0, padding: "4px 7px" }}
                            >
                              ✏
                            </button>
                            <button onClick={() => setProductoAEliminar(p)} style={{ ...styles.buttonDelete, padding: "4px 7px" }}>
                              🗑
                            </button>
                          </div>
                        </div>
                      ))}

                      <div style={{ display: "flex", justifyContent: "center", marginTop: "14px" }}>
                        <button onClick={() => limpiarComprados(s.key)} style={styles.buttonDanger}>
                          Limpiar comprados
                        </button>
                      </div>

                      {limpiarCompradosConfirm.open && limpiarCompradosConfirm.superKey === s.key && (
                        <div style={styles.modalOverlay}>
                          <div style={styles.modal}>
                            <h3>🧹 Limpiar comprados</h3>
                            <p style={{ marginBottom: "20px" }}>
                              ¿Eliminar {totalComprados} producto(s) ya comprados de {nombreVisible}?
                            </p>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <button onClick={() => setLimpiarCompradosConfirm({ open: false, superKey: null })} style={styles.button}>
                                Cancelar
                              </button>
                              <button onClick={confirmarLimpiarComprados} style={styles.buttonDanger}>
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={styles.grid}>
              {SUPERS.map((s) => {
                const lista = productosOrdenadosPorSuper(s.key);
                const nombreVisible = nombresSupers[s.key] || s.defaultName;
                const totalComprados = totalCompradosSuper(s.key);

                return (
                  <div key={s.key} style={styles.card}>
                    <div style={styles.cardHeaderRow}>
                      <h3 style={styles.cardTitle}>· {nombreVisible} ·</h3>
                      <button onClick={() => abrirEditarSuper(s.key)} style={styles.buttonSuperEdit} title="Renombrar supermercado">
                        ✎
                      </button>
                    </div>

                    <div style={styles.superFormRow}>
                      <input
                        type="text"
                        placeholder="Añadir producto..."
                        value={inputsSuper[s.key] || ""}
                        onChange={(e) => setInputSuper(s.key, e.target.value)}
                        style={styles.inputSuper}
                      />
                      <button onClick={() => agregarProducto(s.key)} style={styles.buttonAddInline}>
                        Añadir
                      </button>
                    </div>

                    {lista.length === 0 && <p>No hay productos</p>}

                    {lista.map((p) => (
                      <div key={p.id} style={styles.gastoItem}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", opacity: p.comprado ? 0.55 : 1 }}>
                          <input type="checkbox" checked={p.comprado} onChange={() => toggleComprado(p)} style={{ accentColor: "#22c55e" }} />
                          <span style={{ textDecoration: p.comprado ? "line-through" : "none" }}>{p.nombre}</span>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => {
                              setProductoEditando(p);
                              setEditProductoNombre(p.nombre);
                            }}
                            style={styles.buttonEdit}
                          >
                            ✏
                          </button>
                          <button onClick={() => setProductoAEliminar(p)} style={styles.buttonDelete}>
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}

                    <div style={{ display: "flex", justifyContent: "center", marginTop: "14px" }}>
                      <button onClick={() => limpiarComprados(s.key)} style={styles.buttonDanger}>
                        Limpiar comprados
                      </button>
                    </div>

                    {limpiarCompradosConfirm.open && limpiarCompradosConfirm.superKey === s.key && (
                      <div style={styles.modalOverlay}>
                        <div style={styles.modal}>
                          <h3>🧹 Limpiar comprados</h3>
                          <p style={{ marginBottom: "20px" }}>
                            ¿Eliminar {totalComprados} producto(s) ya comprados de {nombreVisible}?
                          </p>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <button onClick={() => setLimpiarCompradosConfirm({ open: false, superKey: null })} style={styles.button}>
                              Cancelar
                            </button>
                            <button onClick={confirmarLimpiarComprados} style={styles.buttonDanger}>
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {productoEditando && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>✏ Editar Producto</h3>
                <input value={editProductoNombre} onChange={(e) => setEditProductoNombre(e.target.value)} style={styles.input} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                  <button onClick={() => setProductoEditando(null)} style={styles.button}>
                    Cancelar
                  </button>
                  <button onClick={guardarEdicionProducto} style={styles.buttonDanger}>
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          )}

          {productoAEliminar && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>🗑 Confirmar eliminación</h3>
                <p style={{ marginBottom: "20px" }}>¿Eliminar "{productoAEliminar.nombre}" de la lista?</p>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setProductoAEliminar(null)} style={styles.button}>
                    Cancelar
                  </button>
                  <button onClick={confirmarEliminarProducto} style={styles.buttonDanger}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}

          {superEditando && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>✎ Renombrar supermercado</h3>
                <input value={editSuperNombre} onChange={(e) => setEditSuperNombre(e.target.value)} style={styles.input} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                  <button
                    onClick={() => {
                      setSuperEditando(null);
                      setEditSuperNombre("");
                    }}
                    style={styles.button}
                  >
                    Cancelar
                  </button>
                  <button onClick={guardarNombreSuper} style={styles.buttonDanger}>
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== DASHBOARD ===== */}
      {vista === "dashboard" && (
        <>
          <h1 style={styles.title}>💰💶 GESTIÓN MDEKOT 💶💰</h1>

          <div style={styles.selectorRow}>
            <select value={mesActual} onChange={(e) => setMesActual(Number(e.target.value))} style={styles.select}>
              {meses.map((mes, index) => (
                <option key={index} value={index + 1}>
                  {mes}
                </option>
              ))}
            </select>
            <input type="number" value={anioActual} onChange={(e) => setAnioActual(Number(e.target.value))} style={styles.select} />
          </div>

          <div style={getBalanceCardStyle()}>{renderBalanceText()}</div>

          <div style={styles.cardFull}>
            <h3>· Añadir Nuevo Gasto ·</h3>
            <div style={styles.formContainer}>
              <input type="text" placeholder="Comercio" value={comercio} onChange={(e) => setComercio(e.target.value)} style={styles.input} />
              <input type="number" placeholder="Importe" value={importe} onChange={(e) => setImporte(e.target.value)} style={styles.input} />
              <select value={pagadoPor} onChange={(e) => setPagadoPor(e.target.value)} style={styles.input}>
                <option value="mdekot@gmail.com">Mirko</option>
                <option value="jessica.alca87@gmail.com">Jessica</option>
              </select>
              <button onClick={agregarGasto} style={styles.button}>
                Guardar
              </button>
            </div>
          </div>

          <div style={styles.grid}>
            <div style={styles.card}>
              <h3>· GASTOS DEL MES ·</h3>

              {gastos.map((g) => {
                const esMirko = g.pagadoPor === "mdekot@gmail.com";
                const badgeStyle = esMirko ? styles.payMirko : styles.payJessica;
                const badgeIcon = esMirko ? "👨" : "👩";
                const badgeTitle = esMirko ? "Pagó Mirko" : "Pagó Jessica";

                return (
                  <div
                    key={g.id}
                    style={{
                      ...styles.gastoItem,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: isMobile ? "8px" : "0",
                      flexWrap: "nowrap"
                    }}
                  >
                    {isMobile ? (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
                          <span title={badgeTitle} style={{ ...styles.payIcon, ...badgeStyle, flexShrink: 0 }}>
                            {badgeIcon}
                          </span>

                          <span
                            title={`${g.fecha ? new Date(g.fecha.seconds * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) : "--/--"} - ${g.comercio}`}
                            style={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              minWidth: 0,
                              flex: 1,
                              textAlign: "left",
                              fontSize: "14px",
                              lineHeight: 1.2
                            }}
                          >
                            {g.fecha ? new Date(g.fecha.seconds * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) : "--/--"}{" "}
                            - {g.comercio}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: "14px", whiteSpace: "nowrap" }}>{Number(g.importe).toFixed(2)} €</span>
                          <button onClick={() => abrirModalEditar(g)} style={{ ...styles.buttonEdit, marginRight: 0, padding: "4px 7px" }}>
                            ✏
                          </button>
                          <button onClick={() => setGastoAEliminar(g)} style={{ ...styles.buttonDelete, padding: "4px 7px" }}>
                            🗑
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                          <span title={badgeTitle} style={{ ...styles.payIcon, ...badgeStyle }}>
                            {badgeIcon}
                          </span>

                          {g.fecha ? new Date(g.fecha.seconds * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) : "--/--"}{" "}
                          - {g.comercio}
                        </span>

                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ minWidth: "90px", textAlign: "right", fontWeight: "600" }}>{Number(g.importe).toFixed(2)} €</span>
                          <button onClick={() => abrirModalEditar(g)} style={styles.buttonEdit}>
                            ✏
                          </button>
                          <button onClick={() => setGastoAEliminar(g)} style={styles.buttonDelete}>
                            🗑
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={styles.card}>
              <h3>· TOTAL POR COMERCIO ·</h3>
              {Object.entries(resumenComercio).map(([nombre, total]) => (
                <p key={nombre}>
                  {nombre} → {total.toFixed(2)} €
                </p>
              ))}
            </div>

            <div style={styles.card}>
              <h3>· GASTO INDIVIDUAL ·</h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span title="Pagó Mirko" style={{ ...styles.payIcon, ...styles.payMirko }}>
                    👨
                  </span>
                  <span style={{ fontWeight: "600" }}>Mirko → {totalMirko.toFixed(2)} €</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span title="Pagó Jessica" style={{ ...styles.payIcon, ...styles.payJessica }}>
                    👩
                  </span>
                  <span style={{ fontWeight: "600" }}>Jessica → {totalJessica.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h3>· TOTAL GASTOS ·</h3>
              <h2>{totalMes.toFixed(2)} €</h2>
            </div>
          </div>

          <div style={styles.buttonCenter}>
            <button onClick={liquidarMes} style={styles.buttonDanger} disabled={balance === 0}>
              Liquidar mes
            </button>
          </div>

          {liquidarConfirmOpen && balance !== 0 && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>💸 LIQUIDAR MES</h3>
                <p style={{ marginBottom: "18px" }}>
                  ¿{debtInfo.debtorName.toUpperCase()} HA PAGADO LA DEUDA DE {debtInfo.amount.toFixed(2)} €?
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                  <button onClick={() => setLiquidarConfirmOpen(false)} style={styles.button}>
                    Cancelar
                  </button>
                  <button onClick={() => guardarEstadoLiquidacion("unpaid")} style={styles.buttonDanger}>
                    NO
                  </button>
                  <button onClick={() => guardarEstadoLiquidacion("paid")} style={styles.buttonPaid}>
                    SÍ
                  </button>
                </div>
              </div>
            </div>
          )}

          {gastoEditando && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>✏ Editar Gasto</h3>
                <input value={editComercio} onChange={(e) => setEditComercio(e.target.value)} style={styles.input} />
                <input type="number" value={editImporte} onChange={(e) => setEditImporte(e.target.value)} style={styles.input} />
                <select value={editPagadoPor} onChange={(e) => setEditPagadoPor(e.target.value)} style={styles.input}>
                  <option value="mdekot@gmail.com">Mirko</option>
                  <option value="jessica.alca87@gmail.com">Jessica</option>
                </select>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                  <button onClick={() => setGastoEditando(null)} style={styles.button}>
                    Cancelar
                  </button>
                  <button onClick={guardarEdicion} style={styles.buttonDanger}>
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          )}

          {gastoAEliminar && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>🗑 Confirmar eliminación</h3>
                <p style={{ marginBottom: "20px" }}>
                  ¿Eliminar "{gastoAEliminar.comercio}" por {Number(gastoAEliminar.importe).toFixed(2)} €?
                </p>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setGastoAEliminar(null)} style={styles.button}>
                    Cancelar
                  </button>
                  <button onClick={confirmarEliminar} style={styles.buttonDanger}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== GRAFICO ===== */}
      {vista === "grafico" && (
        <div style={{ width: "100%", marginTop: "40px" }}>
          <h2 style={{ textAlign: "center", marginBottom: "30px" }}>📊 Distribución por Comercio</h2>

          {dataGrafico.length === 0 ? (
            <p style={{ textAlign: "center" }}>No hay datos este mes</p>
          ) : (
            <>
              <div style={{ width: "100%", height: `${chartHeight}px`, maxWidth: isMobile ? "100%" : "860px", margin: "0 auto" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataGrafico}
                      dataKey="total"
                      nameKey="nombre"
                      cx="50%"
                      cy="50%"
                      innerRadius={innerRadius}
                      outerRadius={outerRadius}
                      paddingAngle={2}
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {dataGrafico.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>

                    <circle cx="50%" cy="50%" r={centerHoleRadius} fill="white" />
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fill: "#111827", fontSize: `${centerMainFont}px`, fontWeight: 800 }}>
                      {totalMes.toFixed(2)} €
                    </text>
                    <text x="50%" y="50%" dy={isMobile ? 22 : 28} textAnchor="middle" dominantBaseline="middle" style={{ fill: "#111827", fontSize: `${centerSubFont}px`, fontWeight: 600 }}>
                      Total gastado
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={styles.legendBox}>
                {dataGraficoOrdenado.map((item) => (
                  <div key={item.nombre} style={styles.legendRow}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ ...styles.legendDot, background: item.color }} />
                      <span style={{ fontWeight: 700 }}>{item.nombre}</span>
                    </div>
                    <span style={{ fontWeight: 700 }}>{Number(item.total).toFixed(2)} €</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "40px", display: "flex", justifyContent: "center", gap: "60px", flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <h3>Mirko</h3>
                  <p style={{ fontSize: "20px", fontWeight: "600" }}>{totalMirko.toFixed(2)} €</p>
                </div>

                <div style={{ textAlign: "center" }}>
                  <h3>Jessica</h3>
                  <p style={{ fontSize: "20px", fontWeight: "600" }}>{totalJessica.toFixed(2)} €</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { background: "#4a505e", minHeight: "100vh", width: "100%", padding: "40px", color: "white", boxSizing: "border-box" },
  title: { fontSize: "32px", marginBottom: "20px", textAlign: "center" },
  selectorRow: { display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" },
  select: { padding: "8px", borderRadius: "6px" },

  balanceCard: { background: "#1e293b", padding: "20px", borderRadius: "10px", marginBottom: "30px", textAlign: "center", maxWidth: "600px", margin: "0 auto 30px auto" },
  balanceCardPaid: { background: "#22c55e" },
  balanceCardUnpaid: { background: "#ef4444" },
  balanceCardBigText: { color: "#111827", textTransform: "uppercase", fontWeight: 900 },

  cardFull: { background: "#1e293b", padding: "20px", borderRadius: "10px", marginBottom: "30px", textAlign: "center" },
  formContainer: { width: "100%", maxWidth: "500px", margin: "0 auto" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "30px" },
  card: { background: "#1e293b", padding: "20px", borderRadius: "10px", textAlign: "center", boxSizing: "border-box", width: "100%" },
  gastoItem: { display: "flex", justifyContent: "space-between", marginBottom: "8px" },
  input: { display: "block", width: "100%", marginBottom: "10px", padding: "8px", borderRadius: "6px", border: "none" },

  cardHeaderRow: { position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: "10px", minHeight: "34px" },
  cardTitle: { position: "absolute", left: "50%", transform: "translateX(-50%)", margin: 0, width: "100%", textAlign: "center", pointerEvents: "none" },

  superFormRow: { display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginBottom: "10px", width: "100%", boxSizing: "border-box" },
  inputSuper: { display: "block", width: "70%", maxWidth: "260px", padding: "8px", borderRadius: "6px", border: "none" },
  buttonAddInline: { background: "#3b82f6", color: "white", padding: "10px 14px", border: "none", borderRadius: "6px", cursor: "pointer", whiteSpace: "nowrap" },

  button: { background: "#3b82f6", color: "white", padding: "10px", border: "none", borderRadius: "6px", cursor: "pointer" },
  buttonDanger: { background: "#ef4444", color: "white", padding: "10px 15px", border: "none", borderRadius: "6px", cursor: "pointer" },
  buttonPaid: { background: "#22c55e", color: "#111827", padding: "10px 15px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 800 },

  buttonEdit: { background: "#facc15", border: "none", borderRadius: "5px", padding: "4px 8px", marginRight: "5px", cursor: "pointer" },
  buttonDelete: { background: "#ef4444", border: "none", borderRadius: "5px", padding: "4px 8px", cursor: "pointer" },
  buttonCenter: { display: "flex", justifyContent: "center" },
  tabs: { display: "flex", justifyContent: "center", gap: "10px", marginBottom: "20px", flexWrap: "wrap" },
  tab: { background: "#1e293b", color: "white", padding: "10px 20px", border: "none", borderRadius: "6px", cursor: "pointer" },
  tabActive: { background: "#3b82f6", color: "white", padding: "10px 20px", border: "none", borderRadius: "6px", cursor: "pointer" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 },
  modal: { background: "#1e293b", padding: "25px", borderRadius: "10px", width: "90%", maxWidth: "340px" },

  buttonSuperEdit: { background: "#06b6d4", color: "white", border: "none", borderRadius: "999px", width: "34px", height: "34px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },

  payIcon: { width: "28px", height: "28px", borderRadius: "999px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 },
  payMirko: { background: "#22c55e", color: "white" },
  payJessica: { background: "#ec4899", color: "white" },

  legendBox: { maxWidth: "650px", margin: "28px auto 0 auto", background: "#1e293b", padding: "18px", borderRadius: "10px" },
  legendRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  legendDot: { width: "14px", height: "14px", borderRadius: "999px", display: "inline-block" },

  // ===== CALENDARIO STYLES =====
  calHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  buttonAddCalendar: { background: "#06b6d4", color: "white", padding: "10px 14px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 800 },

  // ✅ wrapper para que en móvil el fondo oscuro ocupe toda la pantalla
  calendarPageWrap: { width: "100%", maxWidth: "1100px", margin: "0 auto" },
  calendarPageWrapMobile: { width: "100vw", marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)" },

  calendarCard: { background: "#1e293b", padding: "18px", borderRadius: "10px", boxSizing: "border-box", width: "100%", overflowX: "hidden" },
  calendarCardMobile: { padding: "14px 10px", borderRadius: "10px", width: "100vw" },

  calWeekHeaderUnified: { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "6px", marginBottom: "8px" },
  calWeekHeaderCellUnified: { background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "8px 0", fontWeight: 900, fontSize: "12px" },

  calGridUnified: { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "6px" },

  calCell: { background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "10px", minHeight: "110px", boxSizing: "border-box", display: "flex", flexDirection: "column" },
  calCellMobile2: { background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "7px", minHeight: "72px", boxSizing: "border-box", display: "flex", flexDirection: "column" },

  calCellEmpty: { background: "rgba(255,255,255,0.03)" },
  calCellToday: { outline: "2px solid rgba(34,197,94,0.9)" },
  calCellTopRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" },
  calDayNumber: { fontWeight: 900, opacity: 0.9, fontSize: "13px" },
  calDayNumberToday: { color: "#22c55e" },

  calAddMini: { background: "rgba(59,130,246,0.9)", color: "white", border: "none", borderRadius: "8px", width: "26px", height: "26px", cursor: "pointer", fontWeight: 900 },
  calAddMiniMobile2: { background: "rgba(59,130,246,0.9)", color: "white", border: "none", borderRadius: "8px", width: "22px", height: "22px", cursor: "pointer", fontWeight: 900, fontSize: "14px", lineHeight: "22px", padding: 0 },

  calEventsBox: { display: "flex", flexDirection: "column", gap: "6px", overflow: "hidden" },
  eventChip: { color: "#111827", fontWeight: 900, borderRadius: "8px", padding: "6px 8px", fontSize: "12px", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" },
  eventChipMobile2: { padding: "5px 6px", fontSize: "11px" },
  moreEvents: { opacity: 0.9, fontSize: "12px", textAlign: "left", paddingLeft: "2px" },

  dayDetailRow: { background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "10px" }
};

export default App;
