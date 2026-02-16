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
            {balance > 0 && <h2>Jessica debe {balance} € a Mirko</h2>}
            {balance < 0 && <h2>Mirko debe {Math.abs(balance)} € a Jessica</h2>}
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
                  <span>{g.comercio} - {g.importe} €</span>
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
                <p key={nombre}>{nombre} → {total} €</p>
              ))}
            </div>

            <div style={styles.card}>
              <h3>· GASTO INDIVIDUAL ·</h3>
              <p>Mirko → {totalMirko} €</p>
              <p>Jessica → {totalJessica} €</p>
            </div>

            <div style={styles.card}>
              <h3>· TOTAL GASTOS ·</h3>
              <h2>{totalMes} €</h2>
            </div>
          </div>

          <div style={styles.buttonCenter}>
            <button onClick={liquidarMes} style={styles.buttonDanger}>Liquidar mes</button>
          </div>

        </>
      )}

      {vista === "grafico" && (
        <>
          <h1 style={styles.title}>📊 Gráfico Mensual</h1>
          <div style={{ width: "100%", height: "500px" }}>
            <ResponsiveContainer>
              <BarChart data={datosGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#555" />
                <XAxis dataKey="nombre" stroke="#fff" />
                <YAxis stroke="#fff" />
                <Tooltip />
                <Bar dataKey="total" fill="#3b82f6">
                  <LabelList position="center" formatter={(value) => `${value} €`} fill="#ffffff" />
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
  container:{
    background:"#4a505e",
    minHeight:"100vh",
    width:"100%",
    padding:"40px 40px",
    color:"white",
    boxSizing:"border-box",
    overflowX:"hidden"
  },

  title:{fontSize:"28px",marginBottom:"20px",textAlign:"center"},

  selectorRow:{display:"flex",gap:"10px",marginBottom:"20px",flexWrap:"wrap",justifyContent:"center"},

  select:{padding:"8px",borderRadius:"6px"},

  balanceCard:{background:"#1e293b",padding:"20px",borderRadius:"10px",marginBottom:"30px",textAlign:"center"},

  cardFull:{background:"#1e293b",padding:"25px",borderRadius:"12px",marginBottom:"30px",textAlign:"center"},

  formContainer:{maxWidth:"450px",width:"100%",margin:"0 auto"},

  grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:"25px",marginBottom:"40px"},

  card:{background:"#1e293b",padding:"25px",borderRadius:"12px",textAlign:"center"},

  gastoItem:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"},

  input:{display:"block",width:"100%",marginBottom:"12px",padding:"12px",borderRadius:"6px",border:"none"},

  button:{background:"#3b82f6",color:"white",padding:"12px 16px",border:"none",borderRadius:"8px",cursor:"pointer"},

  buttonDanger:{background:"#ef4444",color:"white",padding:"12px 18px",border:"none",borderRadius:"8px",cursor:"pointer"},

  buttonEdit:{background:"#facc15",border:"none",borderRadius:"6px",padding:"6px 10px",marginRight:"6px",cursor:"pointer"},

  buttonDelete:{background:"#ef4444",border:"none",borderRadius:"6px",padding:"6px 10px",cursor:"pointer"},

  buttonCenter:{display:"flex",justifyContent:"center"},

  tabs:{display:"flex",justifyContent:"center",gap:"10px",marginBottom:"25px",flexWrap:"wrap"},

  tab:{background:"#1e293b",color:"white",padding:"10px 20px",border:"none",borderRadius:"8px",cursor:"pointer"},

  tabActive:{background:"#3b82f6",color:"white",padding:"10px 20px",border:"none",borderRadius:"8px",cursor:"pointer"}
};

export default App;
