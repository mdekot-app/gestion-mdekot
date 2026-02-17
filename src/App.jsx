import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";
import { db } from "./firebase";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList
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

  const meses = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

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

    // 🔥 ORDENAR POR FECHA (más reciente arriba)
    lista.sort((a, b) => {
      if (!a.fecha || !b.fecha) return 0;
      return b.fecha.seconds - a.fecha.seconds;
    });

    setGastos(lista);
    setBalance(totalPagado - totalDebe);
  };

  useEffect(() => {
    calcularBalance();
  }, [mesActual, anioActual]);

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
      comercio,
      fecha: new Date()
    });

    setImporte("");
    setComercio("");
    calcularBalance();
  };

  const confirmarEliminar = async () => {
    await deleteDoc(doc(db, "gastos", gastoAEliminar.id));
    setGastoAEliminar(null);
    calcularBalance();
  };

  const abrirModalEditar = (gasto) => {
    setGastoEditando(gasto);
    setEditComercio(gasto.comercio);
    setEditImporte(gasto.importe);
    setEditPagadoPor(gasto.pagadoPor);
  };

  const guardarEdicion = async () => {
    await updateDoc(doc(db, "gastos", gastoEditando.id), {
      comercio: editComercio,
      importe: Number(editImporte),
      pagadoPor: editPagadoPor
    });

    setGastoEditando(null);
    calcularBalance();
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

    calcularBalance();
  };

  const resumenComercio = {};
  gastos.forEach((g) => {
    if (!resumenComercio[g.comercio]) resumenComercio[g.comercio] = 0;
    resumenComercio[g.comercio] += g.importe;
  });

  const datosGrafico = Object.entries(resumenComercio).map(([nombre, total]) => ({
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

  return (
    <div style={styles.container}>

      <div style={styles.tabs}>
        <button onClick={() => setVista("dashboard")} style={vista === "dashboard" ? styles.tabActive : styles.tab}>
          Dashboard
        </button>
        <button onClick={() => setVista("grafico")} style={vista === "grafico" ? styles.tabActive : styles.tab}>
          Gráfico Mensual
        </button>
      </div>

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
                <div key={g.id} style={styles.gastoItem}>
                  <span>
                    {g.fecha
                      ? new Date(g.fecha.seconds * 1000).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "2-digit"
                        })
                      : "--/--"}
                    {" - "}
                    {g.comercio}
                    {" - "}
                    {Number(g.importe).toFixed(2)} €
                  </span>
                  <div>
                    <button onClick={() => abrirModalEditar(g)} style={styles.buttonEdit}>✏</button>
                    <button onClick={() => setGastoAEliminar(g)} style={styles.buttonDelete}>🗑</button>
                  </div>
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

      {vista === "grafico" && (
        <>
          <h1 style={styles.title}>📊 Gráfico Mensual</h1>
          <div style={{ width: "100%", height: "500px" }}>
            <ResponsiveContainer>
              <BarChart data={datosGrafico} margin={{ top: 20, right: 20, left: 20, bottom: 130 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#555" />
                <XAxis dataKey="nombre" stroke="#fff" interval={0} height={120} angle={-90} textAnchor="end" tick={{ fontSize: 12 }} dy={35} />
                <YAxis stroke="#fff" />
                <Tooltip />
                <Bar dataKey="total" fill="#3b82f6">
                  <LabelList position="center" formatter={(value) => `${value.toFixed(2)} €`} fill="#ffffff" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
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
  gastoItem:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"},
  input:{display:"block",width:"100%",marginBottom:"10px",padding:"8px",borderRadius:"6px",border:"none"},
  button:{background:"#3b82f6",color:"white",padding:"10px",border:"none",borderRadius:"6px",cursor:"pointer"},
  buttonDanger:{background:"#ef4444",color:"white",padding:"10px 15px",border:"none",borderRadius:"6px",cursor:"pointer"},
  buttonEdit:{background:"#facc15",border:"none",borderRadius:"5px",padding:"4px 8px",marginRight:"5px",cursor:"pointer"},
  buttonDelete:{background:"#ef4444",border:"none",borderRadius:"5px",padding:"4px 8px",cursor:"pointer"},
  buttonCenter:{display:"flex",justifyContent:"center"},
  tabs:{display:"flex",justifyContent:"center",gap:"10px",marginBottom:"20px",flexWrap:"wrap"},
  tab:{background:"#1e293b",color:"white",padding:"10px 20px",border:"none",borderRadius:"6px",cursor:"pointer"},
  tabActive:{background:"#3b82f6",color:"white",padding:"10px 20px",border:"none",borderRadius:"6px",cursor:"pointer"},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",justifyContent:"center",alignItems:"center"},
  modal:{background:"#1e293b",padding:"25px",borderRadius:"10px",width:"90%",maxWidth:"320px"}
};

export default App;
