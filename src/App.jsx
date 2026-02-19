import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  writeBatch
} from "firebase/firestore";
import { db } from "./firebase";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts";

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

  // ===== LISTA COMPRA =====
  const [productos, setProductos] = useState([]);
  const [productoEditando, setProductoEditando] = useState(null);
  const [editProductoNombre, setEditProductoNombre] = useState("");
  const [editProductoComercio, setEditProductoComercio] = useState("MERCADONA");
  const [productoAEliminar, setProductoAEliminar] = useState(null);
  const [limpiarCompradosComercio, setLimpiarCompradosComercio] = useState(null);

  const COMERCIOS = ["MERCADONA", "LIDL", "ALCAMPO", "CARREFOUR"];

  // ✅ NUEVO: input independiente por súper
  const [nuevoProductoPorComercio, setNuevoProductoPorComercio] = useState({
    MERCADONA: "",
    LIDL: "",
    ALCAMPO: "",
    CARREFOUR: ""
  });

  // ✅ NUEVO: nombres editables (solo display, el "key" interno se mantiene)
  const [nombreComercio, setNombreComercio] = useState({
    MERCADONA: "MERCADONA",
    LIDL: "LIDL",
    ALCAMPO: "ALCAMPO",
    CARREFOUR: "CARREFOUR"
  });

  const [superEditandoKey, setSuperEditandoKey] = useState(null);
  const [editSuperNombre, setEditSuperNombre] = useState("");

  const normalizarProducto = (p) => {
    const comercioNormalizado = (p.comercio || "MERCADONA").toString().trim().toUpperCase();
    return { ...p, comercio: COMERCIOS.includes(comercioNormalizado) ? comercioNormalizado : "MERCADONA" };
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const meses = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

  const formatearComercio = (texto) => {
    if (!texto) return "";
    return texto
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  };

  const calcularBalance = async () => {
    const snapshot = await getDocs(collection(db, "gastos"));

    let totalPagado = 0;
    let totalDebe = 0;
    let lista = [];

    snapshot.forEach((documento) => {
      const data = documento.data();

      if (
        data.mes === mesActual &&
        data.anio === anioActual &&
        data.liquidado === false
      ) {
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
  };

  useEffect(() => {
    const q = query(collection(db, "gastos"));
    const unsub = onSnapshot(q, (snapshot) => {

      let totalPagado = 0;
      let totalDebe = 0;
      let lista = [];

      snapshot.forEach((documento) => {
        const data = documento.data();

        if (
          data.mes === mesActual &&
          data.anio === anioActual &&
          data.liquidado === false
        ) {
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

  // ===== LISTA COMPRA =====
  const cargarProductos = async () => {
    const snapshot = await getDocs(collection(db, "listaCompra"));
    let lista = [];
    snapshot.forEach((docu) => {
      lista.push(normalizarProducto({ id: docu.id, ...docu.data() }));
    });
    lista.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
    setProductos(lista);
  };

  useEffect(() => {
    const q = query(collection(db, "listaCompra"));
    const unsub = onSnapshot(q, (snapshot) => {
      let lista = [];
      snapshot.forEach((docu) => {
        lista.push(normalizarProducto({ id: docu.id, ...docu.data() }));
      });
      lista.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
      setProductos(lista);
    });

    return () => unsub();
  }, []);

  const cambiarInputComercio = (key, value) => {
    setNuevoProductoPorComercio((prev) => ({ ...prev, [key]: value }));
  };

  const agregarProductoPorComercio = async (comercioObjetivo) => {
    const texto = (nuevoProductoPorComercio[comercioObjetivo] || "").trim();
    if (!texto) return;

    await addDoc(collection(db, "listaCompra"), {
      nombre: texto,
      comprado: false,
      fecha: new Date(),
      comercio: comercioObjetivo
    });

    setNuevoProductoPorComercio((prev) => ({ ...prev, [comercioObjetivo]: "" }));
  };

  const toggleComprado = async (producto) => {
    await updateDoc(doc(db, "listaCompra", producto.id), {
      comprado: !producto.comprado
    });
  };

  const eliminarProducto = async (producto) => {
    await deleteDoc(doc(db, "listaCompra", producto.id));
  };

  const confirmarEliminarProducto = async () => {
    await deleteDoc(doc(db, "listaCompra", productoAEliminar.id));
    setProductoAEliminar(null);
  };

  const guardarEdicionProducto = async () => {
    await updateDoc(doc(db, "listaCompra", productoEditando.id), {
      nombre: editProductoNombre,
      comercio: editProductoComercio
    });
    setProductoEditando(null);
  };

  const limpiarComprados = async (comercioObjetivo) => {
    const comprados = productos.filter(p => p.comercio === comercioObjetivo && p.comprado);
    if (comprados.length === 0) return;
    setLimpiarCompradosComercio(comercioObjetivo);
  };

  const confirmarLimpiarComprados = async () => {
    if (!limpiarCompradosComercio) return;

    const comprados = productos.filter(p => p.comercio === limpiarCompradosComercio && p.comprado);
    if (comprados.length === 0) {
      setLimpiarCompradosComercio(null);
      return;
    }

    const batch = writeBatch(db);
    comprados.forEach((p) => {
      batch.delete(doc(db, "listaCompra", p.id));
    });
    await batch.commit();
    setLimpiarCompradosComercio(null);
  };

  const abrirEditarSuper = (key) => {
    setSuperEditandoKey(key);
    setEditSuperNombre(nombreComercio[key] || key);
  };

  const guardarEditarSuper = () => {
    const limpio = (editSuperNombre || "").trim();
    setNombreComercio((prev) => ({ ...prev, [superEditandoKey]: limpio ? limpio : superEditandoKey }));
    setSuperEditandoKey(null);
  };

  const agregarGasto = async () => {
    if (!importe || !comercio) return;

    await addDoc(collection(db, "gastos"), {
      importe: Number(importe),
      pagadoPor,
      mes: mesActual,
      anio: anioActual,
      liquidado: false,
      divididoEntre: [
        "mdekot@gmail.com",
        "jessica.alca87@gmail.com"
      ],
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

  const liquidarMes = async () => {
    const snapshot = await getDocs(collection(db, "gastos"));

    snapshot.forEach(async (documento) => {
      const data = documento.data();
      if (
        data.mes === mesActual &&
        data.anio === anioActual &&
        data.liquidado === false
      ) {
        await updateDoc(doc(db, "gastos", documento.id), {
          liquidado: true
        });
      }
    });
  };

  const resumenComercio = {};
  gastos.forEach((g) => {
    if (!resumenComercio[g.comercio]) resumenComercio[g.comercio] = 0;
    resumenComercio[g.comercio] += g.importe;
  });

  const dataGrafico = Object.entries(resumenComercio).map(([nombre, total]) => ({
    nombre,
    total
  }));

  let totalMirko = 0;
  let totalJessica = 0;

  gastos.forEach((g) => {
    if (g.pagadoPor === "mdekot@gmail.com") totalMirko += g.importe;
    else totalJessica += g.importe;
  });

  const totalMes = totalMirko + totalJessica;

  const ordenarProductos = (lista) => {
    return [...lista].sort((a, b) => {
      const aC = a.comprado ? 1 : 0;
      const bC = b.comprado ? 1 : 0;
      if (aC !== bC) return aC - bC;
      return (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0);
    });
  };

  const totalCompradosPorComercio = limpiarCompradosComercio
    ? productos.filter(p => p.comercio === limpiarCompradosComercio && p.comprado).length
    : 0;

  return (
    <div style={styles.container}>

      <div style={styles.tabs}>
        <button onClick={() => setVista("dashboard")} style={vista === "dashboard" ? styles.tabActive : styles.tab}>
          Dashboard
        </button>
        <button onClick={() => setVista("grafico")} style={vista === "grafico" ? styles.tabActive : styles.tab}>
          Gráfico Mensual
        </button>
        <button onClick={() => setVista("lista")} style={vista === "lista" ? styles.tabActive : styles.tab}>
          Lista de la Compra
        </button>
      </div>

      {/* ===== LISTA COMPRA ===== */}
      {vista === "lista" && (
        <>
          <h1 style={styles.title}>🛒 LISTA DE LA COMPRA</h1>

          <div style={{...styles.grid, gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)"}}>
            {COMERCIOS.map((c) => {
              const productosDeEste = ordenarProductos(productos.filter(p => p.comercio === c));
              const nombreVisible = nombreComercio[c] || c;
              return (
                <div key={c} style={styles.card}>
                  <div style={styles.cardHeaderRow}>
                    <h3 style={{margin:0}}>· {nombreVisible} ·</h3>
                    <button onClick={() => abrirEditarSuper(c)} style={styles.buttonSuperEdit} title="Renombrar supermercado">✎</button>
                  </div>

                  <div style={{...styles.formContainer, maxWidth:"100%"}}>
                    <input
                      type="text"
                      placeholder="Añadir producto..."
                      value={nuevoProductoPorComercio[c]}
                      onChange={(e) => cambiarInputComercio(c, e.target.value)}
                      style={styles.input}
                    />
                    <button onClick={() => agregarProductoPorComercio(c)} style={styles.button}>
                      Añadir
                    </button>
                    <button onClick={() => limpiarComprados(c)} style={styles.buttonDanger}>
                      Limpiar comprados
                    </button>
                  </div>

                  <div style={{marginTop:"10px", textAlign:"left"}}>
                    {productosDeEste.length === 0 && <p style={{textAlign:"center"}}>No hay productos</p>}

                    {productosDeEste.map((p) => (
                      <div key={p.id} style={{...styles.gastoItem, opacity: p.comprado ? 0.5 : 1}}>
                        <div style={{display:"flex", alignItems:"center", gap:"10px"}}>
                          <input
                            type="checkbox"
                            checked={p.comprado}
                            onChange={() => toggleComprado(p)}
                          />
                          <span style={{textDecoration: p.comprado ? "line-through" : "none"}}>
                            {p.nombre}
                          </span>
                        </div>

                        <div style={{display:"flex", gap:"8px"}}>
                          <button onClick={() => {setProductoEditando(p); setEditProductoNombre(p.nombre); setEditProductoComercio(p.comercio || "MERCADONA");}} style={styles.buttonEdit}>✏</button>
                          <button onClick={() => setProductoAEliminar(p)} style={styles.buttonDelete}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {productoEditando && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>✏ Editar Producto</h3>
                <input
                  value={editProductoNombre}
                  onChange={(e) => setEditProductoNombre(e.target.value)}
                  style={styles.input}
                />
                <select value={editProductoComercio} onChange={(e) => setEditProductoComercio(e.target.value)} style={styles.input}>
                  {COMERCIOS.map((c) => (
                    <option key={c} value={c}>{nombreComercio[c] || c}</option>
                  ))}
                </select>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:"10px" }}>
                  <button onClick={() => setProductoEditando(null)} style={styles.button}>Cancelar</button>
                  <button onClick={guardarEdicionProducto} style={styles.buttonDanger}>Guardar</button>
                </div>
              </div>
            </div>
          )}

          {productoAEliminar && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>🗑 Confirmar eliminación</h3>
                <p style={{marginBottom:"20px"}}>
                  ¿Eliminar "{productoAEliminar.nombre}" de la lista?
                </p>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <button onClick={() => setProductoAEliminar(null)} style={styles.button}>Cancelar</button>
                  <button onClick={confirmarEliminarProducto} style={styles.buttonDanger}>Eliminar</button>
                </div>
              </div>
            </div>
          )}

          {limpiarCompradosComercio && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>🧹 Limpiar comprados</h3>
                <p style={{marginBottom:"20px"}}>
                  ¿Eliminar {totalCompradosPorComercio} producto(s) ya comprados de {nombreComercio[limpiarCompradosComercio] || limpiarCompradosComercio}?
                </p>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <button onClick={() => setLimpiarCompradosComercio(null)} style={styles.button}>Cancelar</button>
                  <button onClick={confirmarLimpiarComprados} style={styles.buttonDanger}>Eliminar</button>
                </div>
              </div>
            </div>
          )}

          {superEditandoKey && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>🏪 Renombrar Supermercado</h3>
                <input
                  value={editSuperNombre}
                  onChange={(e) => setEditSuperNombre(e.target.value)}
                  style={styles.input}
                />
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:"10px" }}>
                  <button onClick={() => setSuperEditandoKey(null)} style={styles.button}>Cancelar</button>
                  <button onClick={guardarEditarSuper} style={styles.buttonDanger}>Guardar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== DASHBOARD ORIGINAL ===== */}
      {vista === "dashboard" && (
        <>
          <h1 style={styles.title}>💰💶 GESTIÓN MDEKOT 💶💰</h1>

          <div style={styles.selectorRow}>
            <select value={mesActual} onChange={(e) => setMesActual(Number(e.target.value))} style={styles.select}>
              {meses.map((mes, index) => (
                <option key={index} value={index + 1}>{mes}</option>
              ))}
            </select>
            <input type="number" value={anioActual} onChange={(e) => setAnioActual(Number(e.target.value))} style={styles.select} />
          </div>

          <div style={styles.balanceCard}>
            {balance > 0 && <h2>Jessica debe {balance.toFixed(2)} € a Mirko</h2>}
            {balance < 0 && <h2>Mirko debe {Math.abs(balance).toFixed(2)} € a Jessica</h2>}
            {balance === 0 && <h2>⚖️ Estáis en empate</h2>}
          </div>

          <div style={styles.cardFull}>
            <h3>· Añadir Nuevo Gasto ·</h3>
            <div style={styles.formContainer}>
              <input type="text" placeholder="Comercio" value={comercio} onChange={(e) => setComercio(e.target.value)} style={styles.input}/>
              <input type="number" placeholder="Importe" value={importe} onChange={(e) => setImporte(e.target.value)} style={styles.input}/>
              <select value={pagadoPor} onChange={(e) => setPagadoPor(e.target.value)} style={styles.input}>
                <option value="mdekot@gmail.com">Mirko</option>
                <option value="jessica.alca87@gmail.com">Jessica</option>
              </select>
              <button onClick={agregarGasto} style={styles.button}>Guardar</button>
            </div>
          </div>

          <div style={styles.grid}>
            <div style={styles.card}>
              <h3>· GASTOS DEL MES ·</h3>

              {gastos.map((g) => (
                <div
                  key={g.id}
                  style={{
                    ...styles.gastoItem,
                    flexDirection: isMobile ? "column" : "row",
                    alignItems: isMobile ? "stretch" : "center"
                  }}
                >
                  {isMobile ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>
                          {g.fecha
                            ? new Date(g.fecha.seconds * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
                            : "--/--"}{" - "}{g.comercio}
                        </span>
                        <span style={{ fontWeight: "600" }}>
                          {Number(g.importe).toFixed(2)} €
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
                        <button onClick={() => abrirModalEditar(g)} style={styles.buttonEdit}>✏</button>
                        <button onClick={() => setGastoAEliminar(g)} style={styles.buttonDelete}>🗑</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span>
                        {g.fecha
                          ? new Date(g.fecha.seconds * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
                          : "--/--"}{" - "}{g.comercio}
                      </span>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ minWidth: "90px", textAlign: "right", fontWeight: "600" }}>
                          {Number(g.importe).toFixed(2)} €
                        </span>
                        <button onClick={() => abrirModalEditar(g)} style={styles.buttonEdit}>✏</button>
                        <button onClick={() => setGastoAEliminar(g)} style={styles.buttonDelete}>🗑</button>
                      </div>
                    </>
                  )}
                </div>
              ))}

            </div>

            <div style={styles.card}>
              <h3>· TOTAL POR COMERCIO ·</h3>
              {Object.entries(resumenComercio).map(([nombre, total]) => (
                <p key={nombre}>{nombre} → {total.toFixed(2)} €</p>
              ))}
            </div>

            <div style={styles.card}>
              <h3>· GASTO INDIVIDUAL ·</h3>
              <p>Mirko → {totalMirko.toFixed(2)} €</p>
              <p>Jessica → {totalJessica.toFixed(2)} €</p>
            </div>

            <div style={styles.card}>
              <h3>· TOTAL GASTOS ·</h3>
              <h2>{totalMes.toFixed(2)} €</h2>
            </div>
          </div>

          <div style={styles.buttonCenter}>
            <button onClick={liquidarMes} style={styles.buttonDanger}>Liquidar mes</button>
          </div>

          {gastoEditando && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>✏ Editar Gasto</h3>
                <input value={editComercio} onChange={(e) => setEditComercio(e.target.value)} style={styles.input}/>
                <input type="number" value={editImporte} onChange={(e) => setEditImporte(e.target.value)} style={styles.input}/>
                <select value={editPagadoPor} onChange={(e) => setEditPagadoPor(e.target.value)} style={styles.input}>
                  <option value="mdekot@gmail.com">Mirko</option>
                  <option value="jessica.alca87@gmail.com">Jessica</option>
                </select>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:"10px" }}>
                  <button onClick={() => setGastoEditando(null)} style={styles.button}>Cancelar</button>
                  <button onClick={guardarEdicion} style={styles.buttonDanger}>Guardar</button>
                </div>
              </div>
            </div>
          )}

          {gastoAEliminar && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>🗑 Confirmar eliminación</h3>
                <p style={{marginBottom:"20px"}}>
                  ¿Eliminar "{gastoAEliminar.comercio}" por {Number(gastoAEliminar.importe).toFixed(2)} €?
                </p>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <button onClick={() => setGastoAEliminar(null)} style={styles.button}>Cancelar</button>
                  <button onClick={confirmarEliminar} style={styles.buttonDanger}>Eliminar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== GRAFICO ORIGINAL ===== */}
      {vista === "grafico" && (
        <div style={{ width: "100%", marginTop: "40px" }}>

          <h2 style={{ textAlign: "center", marginBottom: "30px" }}>
            📊 Distribución por Comercio
          </h2>

          {dataGrafico.length === 0 ? (
            <p style={{ textAlign: "center" }}>No hay datos este mes</p>
          ) : (
            <>
              <div style={{ width: "100%", height: "400px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataGrafico}
                      dataKey="total"
                      nameKey="nombre"
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={140}
                      paddingAngle={3}
                    >
                      {dataGrafico.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"][index % 6]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ marginTop: "40px", display: "flex", justifyContent: "center", gap: "60px", flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <h3>Mirko</h3>
                  <p style={{ fontSize: "20px", fontWeight: "600" }}>
                    {totalMirko.toFixed(2)} €
                  </p>
                </div>

                <div style={{ textAlign: "center" }}>
                  <h3>Jessica</h3>
                  <p style={{ fontSize: "20px", fontWeight: "600" }}>
                    {totalJessica.toFixed(2)} €
                  </p>
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
  container:{background:"#4a505e",minHeight:"100vh",width:"100%",padding:"40px",color:"white",boxSizing:"border-box"},
  title:{fontSize:"32px",marginBottom:"20px",textAlign:"center"},
  selectorRow:{display:"flex",gap:"10px",marginBottom:"20px",flexWrap:"wrap"},
  select:{padding:"8px",borderRadius:"6px"},
  balanceCard:{background:"#1e293b",padding:"20px",borderRadius:"10px",marginBottom:"30px",textAlign:"center",maxWidth:"600px",margin:"0 auto 30px auto"},
  cardFull:{background:"#1e293b",padding:"20px",borderRadius:"10px",marginBottom:"30px",textAlign:"center"},
  formContainer:{width:"100%",maxWidth:"500px",margin:"0 auto"},
  grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:"20px",marginBottom:"30px"},
  card:{background:"#1e293b",padding:"20px",borderRadius:"10px",textAlign:"center"},
  cardHeaderRow:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px"},
  gastoItem:{display:"flex",justifyContent:"space-between",marginBottom:"8px"},
  input:{display:"block",width:"100%",marginBottom:"10px",padding:"8px",borderRadius:"6px",border:"none"},
  button:{background:"#3b82f6",color:"white",padding:"10px",border:"none",borderRadius:"6px",cursor:"pointer"},
  buttonDanger:{background:"#ef4444",color:"white",padding:"10px 15px",border:"none",borderRadius:"6px",cursor:"pointer"},
  buttonEdit:{background:"#facc15",border:"none",borderRadius:"5px",padding:"4px 8px",marginRight:"5px",cursor:"pointer"},
  buttonDelete:{background:"#ef4444",border:"none",borderRadius:"5px",padding:"4px 8px",cursor:"pointer"},
  buttonSuperEdit:{background:"#06b6d4",color:"white",border:"none",borderRadius:"999px",width:"30px",height:"30px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},
  buttonCenter:{display:"flex",justifyContent:"center"},
  tabs:{display:"flex",justifyContent:"center",gap:"10px",marginBottom:"20px",flexWrap:"wrap"},
  tab:{background:"#1e293b",color:"white",padding:"10px 20px",border:"none",borderRadius:"6px",cursor:"pointer"},
  tabActive:{background:"#3b82f6",color:"white",padding:"10px 20px",border:"none",borderRadius:"6px",cursor:"pointer"},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",justifyContent:"center",alignItems:"center"},
  modal:{background:"#1e293b",padding:"25px",borderRadius:"10px",width:"90%",maxWidth:"320px"}
};

export default App;
