import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, 
  TextInput, Modal, ScrollView, Linking, Alert 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  // --- ESTADOS DE LA APP ---
  const [tasaBCV, setTasaBCV] = useState(36.50);
  const [cargandoTasa, setCargandoTasa] = useState(false);
  const [vistaActual, setVistaActual] = useState('pos'); // 'pos', 'inventario', 'deudores', 'cierre'

  // Conversor Rápido
  const [montoUSD, setMontoUSD] = useState('');
  const [montoBS, setMontoBS] = useState('');

  // Notificación de ítem agregado al carrito
  const [mensajeNotif, setMensajeNotif] = useState('');

  // Datos Persistentes
  const [productos, setProductos] = useState([
    { id: '1', nombre: 'Arroz 1Kg', costoUSD: 1.00, margen: 20, codigo: '750123456' },
    { id: '2', nombre: 'Aceite 1L', costoUSD: 2.20, margen: 25, codigo: '750987654' },
    { id: '3', nombre: 'Harina PAN', costoUSD: 1.10, margen: 18, codigo: '750111222' },
  ]);
  const [ventas, setVentas] = useState([]);
  const [deudores, setDeudores] = useState([]);

  // Formulario Nuevo Producto (Inventario)
  const [modalProdVisible, setModalProdVisible] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [modoIngreso, setModoIngreso] = useState('USD'); // 'USD' o 'BS'
  const [nuevoCostoUSD, setNuevoCostoUSD] = useState('');
  const [nuevoCostoBS, setNuevoCostoBS] = useState('');
  const [nuevoMargen, setNuevoMargen] = useState('20');
  const [nuevoCodigo, setNuevoCodigo] = useState('');

  // Carrito de Compras & Modal Pago
  const [carrito, setCarrito] = useState([]);
  const [modalPagoVisible, setModalPagoVisible] = useState(false);
  const [metodoPago, setMetodoPago] = useState('');
  const [nombreClienteFiao, setNombreClienteFiao] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');

  // --- PERSISTENCIA CON ASYNCSTORAGE ---
  useEffect(() => {
    cargarDatosGuardados();
    obtenerTasaBCV();
  }, []);

  const guardarDatos = async (clave, valor) => {
    try {
      await AsyncStorage.setItem(clave, JSON.stringify(valor));
    } catch (e) {
      console.log('Error al guardar datos:', e);
    }
  };

  const cargarDatosGuardados = async () => {
    try {
      const pGuardados = await AsyncStorage.getItem('@productos_servimaxi');
      const vGuardadas = await AsyncStorage.getItem('@ventas_servimaxi');
      const dGuardados = await AsyncStorage.getItem('@deudores_servimaxi');
      if (pGuardados) setProductos(JSON.parse(pGuardados));
      if (vGuardadas) setVentas(JSON.parse(vGuardadas));
      if (dGuardados) setDeudores(JSON.parse(dGuardados));
    } catch (e) {
      console.log('Error al cargar datos:', e);
    }
  };

  // --- CONSULTA TASA BCV ---
  const obtenerTasaBCV = async () => {
    setCargandoTasa(true);
    try {
      const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      const data = await res.json();
      if (data && data.promedio) {
        setTasaBCV(data.promedio);
      }
    } catch (error) {
      console.log("Usando tasa por defecto.");
    } finally {
      setCargandoTasa(false);
    }
  };

  // --- CÁLCULO DE PRECIOS Y COSTOS ---
  const calcularPrecioVentaUSD = (costo, margen) => costo + (costo * (margen / 100));

  // Manejo de entradas bidireccionales en Formulario de Inventario
  const cambiarCostoUSD = (val) => {
    setNuevoCostoUSD(val);
    if (val === '' || isNaN(val)) {
      setNuevoCostoBS('');
    } else {
      setNuevoCostoBS((parseFloat(val) * tasaBCV).toFixed(2));
    }
  };

  const cambiarCostoBS = (val) => {
    setNuevoCostoBS(val);
    if (val === '' || isNaN(val)) {
      setNuevoCostoUSD('');
    } else {
      setNuevoCostoUSD((parseFloat(val) / tasaBCV).toFixed(2));
    }
  };

  const agregarNuevoProducto = () => {
    if (!nuevoNombre || !nuevoCostoUSD || !nuevoMargen) {
      Alert.alert("Campos requeridos", "Por favor completa el nombre, costo y % de ganancia.");
      return;
    }

    const prod = {
      id: Date.now().toString(),
      nombre: nuevoNombre,
      costoUSD: parseFloat(nuevoCostoUSD),
      margen: parseFloat(nuevoMargen),
      codigo: nuevoCodigo || 'SIN-CODIGO'
    };

    const productosActualizados = [...productos, prod];
    setProductos(productosActualizados);
    guardarDatos('@productos_servimaxi', productosActualizados);

    // Limpiar campos y cerrar
    setNuevoNombre('');
    setNuevoCostoUSD('');
    setNuevoCostoBS('');
    setNuevoMargen('20');
    setNuevoCodigo('');
    setModalProdVisible(false);
  };

  const eliminarProducto = (id) => {
    const filtrados = productos.filter(p => p.id !== id);
    setProductos(filtrados);
    guardarDatos('@productos_servimaxi', filtrados);
  };

  // --- LÓGICA DE CARRITO ---
  const agregarAlCarrito = (producto) => {
    const existe = carrito.find(item => item.id === producto.id);
    if (existe) {
      setCarrito(carrito.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item));
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    }

    // Feedback visual
    setMensajeNotif(`➕ Agregado: ${producto.nombre}`);
    setTimeout(() => setMensajeNotif(''), 2000);
  };

  const totalUSD = carrito.reduce((sum, i) => sum + (calcularPrecioVentaUSD(i.costoUSD, i.margen) * i.cantidad), 0);
  const totalBS = totalUSD * tasaBCV;

  // --- CONVERSOR BI-DIRECCIONAL ---
  const cambiarUSD = (val) => {
    setMontoUSD(val);
    setMontoBS(val === '' ? '' : (parseFloat(val) * tasaBCV).toFixed(2));
  };

  const cambiarBS = (val) => {
    setMontoBS(val);
    setMontoUSD(val === '' ? '' : (parseFloat(val) / tasaBCV).toFixed(2));
  };

  // --- PROCESAR VENTA Y COBRO ---
  const finalizarVenta = () => {
    if (!metodoPago) {
      Alert.alert("Atención", "Selecciona un método de pago.");
      return;
    }

    if (metodoPago === 'Fiao' && !nombreClienteFiao) {
      Alert.alert("Atención", "Ingresa el nombre del cliente para registrar la deuda.");
      return;
    }

    const nuevaVenta = {
      id: Date.now().toString(),
      fecha: new Date().toLocaleDateString(),
      totalUSD,
      totalBS,
      metodoPago,
      cliente: nombreClienteFiao || 'Cliente General'
    };

    const ventasActualizadas = [...ventas, nuevaVenta];
    setVentas(ventasActualizadas);
    guardarDatos('@ventas_servimaxi', ventasActualizadas);

    if (metodoPago === 'Fiao') {
      const nuevoDeudor = {
        id: Date.now().toString(),
        nombre: nombreClienteFiao,
        telefono: telefonoCliente,
        montoUSD: totalUSD,
        montoBS: totalBS,
        fecha: new Date().toLocaleDateString()
      };
      const deudoresActualizados = [...deudores, nuevoDeudor];
      setDeudores(deudoresActualizados);
      guardarDatos('@deudores_servimaxi', deudoresActualizados);
    }

    // Generar Ticket por WhatsApp
    let detalle = `📄 *TICKET DE VENTA - SERVIMAXI*\n\n`;
    carrito.forEach(i => {
      const pUSD = calcularPrecioVentaUSD(i.costoUSD, i.margen);
      detalle += `• ${i.nombre} x${i.cantidad} = $${(pUSD * i.cantidad).toFixed(2)}\n`;
    });
    detalle += `\n*TOTAL:* $${totalUSD.toFixed(2)} / Bs. ${totalBS.toFixed(2)}`;
    detalle += `\n*Método de Pago:* ${metodoPago}`;

    const url = `whatsapp://send?text=${encodeURIComponent(detalle)}${telefonoCliente ? `&phone=${telefonoCliente}` : ''}`;
    Linking.openURL(url).catch(() => Alert.alert("Éxito", "Venta registrada en el sistema."));

    setCarrito([]);
    setModalPagoVisible(false);
    setMetodoPago('');
    setNombreClienteFiao('');
    setTelefonoCliente('');
  };

  const cobrarPorWhatsApp = (deudor) => {
    const msj = `Hola ${deudor.nombre}, te saludamos de Servimaxi. Te recordamos tu saldo pendiente de $${deudor.montoUSD.toFixed(2)} (Bs. ${deudor.montoBS.toFixed(2)} a la tasa BCV de Bs. ${tasaBCV.toFixed(2)}). ¡Muchas gracias!`;
    const url = `whatsapp://send?text=${encodeURIComponent(msj)}${deudor.telefono ? `&phone=${deudor.telefono}` : ''}`;
    Linking.openURL(url).catch(() => Alert.alert("Error", "No se pudo abrir WhatsApp."));
  };

  const totalCierreUSD = ventas.reduce((s, v) => s + v.totalUSD, 0);
  const totalCierreBS = totalCierreUSD * tasaBCV;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* CABECERA */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitulo}>Servimaxi POS</Text>
          <Text style={styles.headerSub}>Tasa BCV: Bs. {tasaBCV.toFixed(2)}</Text>
        </View>
        <TouchableOpacity style={styles.btnActualizar} onPress={obtenerTasaBCV}>
          <Text style={{fontSize: 16}}>{cargandoTasa ? '...' : '🔄'}</Text>
        </TouchableOpacity>
      </View>

      {/* MENÚ DE NAVEGACIÓN PRINCIPAL */}
      <View style={styles.navBar}>
        <TouchableOpacity 
          style={[styles.btnNav, vistaActual === 'pos' && styles.btnNavActivo]} 
          onPress={() => setVistaActual('pos')}>
          <Text style={styles.navTexto}>🛒 Vender</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.btnNav, vistaActual === 'inventario' && styles.btnNavActivo]} 
          onPress={() => setVistaActual('inventario')}>
          <Text style={styles.navTexto}>📦 Inventario</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.btnNav, vistaActual === 'deudores' && styles.btnNavActivo]} 
          onPress={() => setVistaActual('deudores')}>
          <Text style={styles.navTexto}>📋 Fiaos ({deudores.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.btnNav, vistaActual === 'cierre' && styles.btnNavActivo]} 
          onPress={() => setVistaActual('cierre')}>
          <Text style={styles.navTexto}>📊 Cierre</Text>
        </TouchableOpacity>
      </View>

      {/* BANNER DE NOTIFICACIÓN DE PRODUCTO AGREGADO */}
      {mensajeNotif !== '' && (
        <View style={styles.bannerNotif}>
          <Text style={{color: '#fff', fontWeight: 'bold', textAlign: 'center'}}>{mensajeNotif}</Text>
        </View>
      )}

      {/* VISTA 1: PUNTO DE VENTA (VENDER) */}
      {vistaActual === 'pos' && (
        <ScrollView style={{flex: 1}}>
          <View style={styles.conversorCaja}>
            <Text style={styles.conversorTitulo}>💱 Conversor Rápido ($ / Bs.)</Text>
            <View style={styles.conversorInputs}>
              <TextInput 
                style={styles.inputConv} 
                placeholder="$ USD" 
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={montoUSD}
                onChangeText={cambiarUSD}
              />
              <Text style={{color: '#fff', fontSize: 18}}>═</Text>
              <TextInput 
                style={styles.inputConv} 
                placeholder="Bs." 
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={montoBS}
                onChangeText={cambiarBS}
              />
            </View>
          </View>

          <Text style={styles.seccionTitulo}>📦 Toca un producto para agregar al carrito</Text>
          {productos.length === 0 ? (
            <Text style={{color: '#94a3b8', textAlign: 'center', marginTop: 20}}>No hay productos. Ve a la pestaña 'Inventario' para registrar el primero.</Text>
          ) : (
            productos.map(item => {
              const pUSD = calcularPrecioVentaUSD(item.costoUSD, item.margen);
              const pBS = pUSD * tasaBCV;
              return (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.tarjetaProducto} 
                  onPress={() => agregarAlCarrito(item)}
                  activeOpacity={0.7}
                >
                  <View style={{flex: 1}}>
                    <Text style={styles.prodNombre}>{item.nombre}</Text>
                    <Text style={styles.prodMargen}>Margen: +{item.margen}% | Cód: {item.codigo}</Text>
                  </View>
                  <View style={{alignItems: 'flex-end'}}>
                    <Text style={styles.prodPrecioUSD}>${pUSD.toFixed(2)}</Text>
                    <Text style={styles.prodPrecioBS}>Bs. {pBS.toFixed(2)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* VISTA 2: GESTIÓN DE INVENTARIO */}
      {vistaActual === 'inventario' && (
        <ScrollView style={{flex: 1}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
            <Text style={styles.seccionTitulo}>Inventario ({productos.length})</Text>
            <TouchableOpacity style={styles.btnNuevoProd} onPress={() => setModalProdVisible(true)}>
              <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 12}}>+ Agregar Producto</Text>
            </TouchableOpacity>
          </View>

          {productos.map(item => {
            const pUSD = calcularPrecioVentaUSD(item.costoUSD, item.margen);
            const pBS = pUSD * tasaBCV;
            return (
              <View key={item.id} style={styles.tarjetaInventario}>
                <View style={{flex: 1}}>
                  <Text style={styles.prodNombre}>{item.nombre}</Text>
                  <Text style={{color: '#94a3b8', fontSize: 12}}>
                    Costo: ${item.costoUSD.toFixed(2)} (Bs. {(item.costoUSD * tasaBCV).toFixed(2)})
                  </Text>
                  <Text style={{color: '#38bdf8', fontSize: 12}}>Ganancia: +{item.margen}% | Cód: {item.codigo}</Text>
                  <Text style={{color: '#22c55e', fontWeight: 'bold', marginTop: 4}}>
                    Precio Venta: ${pUSD.toFixed(2)} / Bs. {pBS.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity style={styles.btnEliminar} onPress={() => eliminarProducto(item.id)}>
                  <Text style={{color: '#fff', fontSize: 12}}>🗑️</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* VISTA 3: CLIENTES FIAOS */}
      {vistaActual === 'deudores' && (
        <ScrollView style={{flex: 1}}>
          <Text style={styles.seccionTitulo}>📋 Cuentas por Cobrar (Fiao)</Text>
          {deudores.length === 0 ? (
            <Text style={{color: '#94a3b8', textAlign: 'center', marginTop: 20}}>No hay deudas registradas.</Text>
          ) : (
            deudores.map(item => (
              <View key={item.id} style={styles.tarjetaDeudor}>
                <View>
                  <Text style={styles.prodNombre}>{item.nombre}</Text>
                  <Text style={{color: '#ef4444', fontWeight: 'bold'}}>${item.montoUSD.toFixed(2)} / Bs. {item.montoBS.toFixed(2)}</Text>
                  <Text style={{color: '#64748b', fontSize: 11}}>Fecha: {item.fecha}</Text>
                </View>
                <TouchableOpacity style={styles.btnCobrarWhatsApp} onPress={() => cobrarPorWhatsApp(item)}>
                  <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 12}}>Cobrar 📲</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* VISTA 4: CIERRE DE CAJA */}
      {vistaActual === 'cierre' && (
        <ScrollView style={{flex: 1}}>
          <Text style={styles.seccionTitulo}>📊 Resumen de Ventas</Text>
          <View style={styles.cajaCierre}>
            <Text style={{color: '#cbd5e1'}}>Total General Día:</Text>
            <Text style={styles.cierreMontoUSD}>${totalCierreUSD.toFixed(2)}</Text>
            <Text style={styles.cierreMontoBS}>Bs. {totalCierreBS.toFixed(2)}</Text>
            <Text style={{color: '#38bdf8', marginTop: 5}}>Total Tickets: {ventas.length}</Text>
          </View>

          <Text style={[styles.seccionTitulo, {marginTop: 15}]}>Historial de Transacciones</Text>
          {ventas.map(v => (
            <View key={v.id} style={styles.tarjetaVenta}>
              <View>
                <Text style={{color: '#fff', fontWeight: 'bold'}}>{v.cliente}</Text>
                <Text style={{color: '#94a3b8', fontSize: 12}}>Método: {v.metodoPago}</Text>
              </View>
              <Text style={{color: '#22c55e', fontWeight: 'bold'}}>${v.totalUSD.toFixed(2)}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* BARRA FLOTANTE DEL CARRITO */}
      {vistaActual === 'pos' && carrito.length > 0 && (
        <View style={styles.barraCarrito}>
          <View>
            <Text style={styles.cartTotalUSD}>Total: ${totalUSD.toFixed(2)}</Text>
            <Text style={styles.cartTotalBS}>Bs. {totalBS.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.btnCobrar} onPress={() => setModalPagoVisible(true)}>
            <Text style={styles.btnTexto}>COBRAR ({carrito.reduce((s, i) => s + i.cantidad, 0)})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL REGISTRAR PRODUCTO */}
      <Modal visible={modalProdVisible} animationType="slide" transparent={true}>
        <View style={styles.modalFondo}>
          <View style={styles.modalContenido}>
            <Text style={styles.modalTitulo}>📦 Registrar Producto</Text>
            
            <TextInput 
              style={styles.inputModal} 
              placeholder="Nombre del Producto (ej: Aceite 1L)" 
              placeholderTextColor="#94a3b8"
              value={nuevoNombre}
              onChangeText={setNuevoNombre}
            />

            {/* SELECCIÓN DE ENTRADA EN $ O BS */}
            <Text style={{color: '#cbd5e1', fontSize: 12, marginBottom: 5}}>Ingresar Costo en:</Text>
            <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
              <TouchableOpacity 
                style={[styles.btnOpcion, modoIngreso === 'USD' && styles.btnOpcionActiva]}
                onPress={() => setModoIngreso('USD')}
              >
                <Text style={{color: '#fff', fontWeight: 'bold'}}>Dólares ($)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btnOpcion, modoIngreso === 'BS' && styles.btnOpcionActiva]}
                onPress={() => setModoIngreso('BS')}
              >
                <Text style={{color: '#fff', fontWeight: 'bold'}}>Bolívares (Bs.)</Text>
              </TouchableOpacity>
            </View>

            {modoIngreso === 'USD' ? (
              <TextInput 
                style={styles.inputModal} 
                placeholder="Costo Base en $ USD (ej: 1.50)" 
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={nuevoCostoUSD}
                onChangeText={cambiarCostoUSD}
              />
            ) : (
              <TextInput 
                style={styles.inputModal} 
                placeholder="Costo Base en Bs. (ej: 50.00)" 
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={nuevoCostoBS}
                onChangeText={cambiarCostoBS}
              />
            )}

            {nuevoCostoUSD !== '' && (
              <Text style={{color: '#38bdf8', fontSize: 12, marginBottom: 10}}>
                Equivale a: ${nuevoCostoUSD} USD / Bs. {nuevoCostoBS}
              </Text>
            )}

            <TextInput 
              style={styles.inputModal} 
              placeholder="% Margen de Ganancia (ej: 20 para 20%)" 
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={nuevoMargen}
              onChangeText={setNuevoMargen}
            />

            <TextInput 
              style={styles.inputModal} 
              placeholder="Código de Barras / SKU (Opcional)" 
              placeholderTextColor="#94a3b8"
              value={nuevoCodigo}
              onChangeText={setNuevoCodigo}
            />

            <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
              <TouchableOpacity style={[styles.btnAccion, {backgroundColor: '#ef4444'}]} onPress={() => setModalProdVisible(false)}>
                <Text style={styles.btnTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnAccion, {backgroundColor: '#2563eb'}]} onPress={agregarNuevoProducto}>
                <Text style={styles.btnTexto}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL MÉTODOS DE PAGO */}
      <Modal visible={modalPagoVisible} animationType="slide" transparent={true}>
        <View style={styles.modalFondo}>
          <View style={styles.modalContenido}>
            <Text style={styles.modalTitulo}>Procesar Cobro</Text>
            <Text style={{color: '#cbd5e1', marginBottom: 15}}>Total: ${totalUSD.toFixed(2)} / Bs. {totalBS.toFixed(2)}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15}}>
              {['Efectivo', 'Pago Móvil', 'Transferencia', 'BioPago', 'Tarjeta', 'Fiao'].map(m => (
                <TouchableOpacity 
                  key={m} 
                  style={[styles.btnMetodo, metodoPago === m && styles.btnMetodoActivo]}
                  onPress={() => setMetodoPago(m)}
                >
                  <Text style={{color: '#fff', fontWeight: 'bold'}}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {metodoPago === 'Fiao' && (
              <TextInput 
                style={styles.inputModal} 
                placeholder="Nombre del Cliente Deudor" 
                placeholderTextColor="#94a3b8"
                value={nombreClienteFiao}
                onChangeText={setNombreClienteFiao}
              />
            )}

            <TextInput 
              style={styles.inputModal} 
              placeholder="Teléfono Cliente (WhatsApp)" 
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              value={telefonoCliente}
              onChangeText={setTelefonoCliente}
            />

            <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
              <TouchableOpacity style={[styles.btnAccion, {backgroundColor: '#ef4444'}]} onPress={() => setModalPagoVisible(false)}>
                <Text style={styles.btnTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnAccion, {backgroundColor: '#22c55e'}]} onPress={finalizarVenta}>
                <Text style={styles.btnTexto}>Enviar Ticket 📲</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingTop: 40, paddingHorizontal: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerTitulo: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc' },
  headerSub: { fontSize: 13, color: '#38bdf8', fontWeight: '600' },
  btnActualizar: { backgroundColor: '#1e293b', padding: 8, borderRadius: 8 },

  navBar: { flexDirection: 'row', gap: 5, marginBottom: 10 },
  btnNav: { flex: 1, backgroundColor: '#1e293b', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnNavActivo: { backgroundColor: '#2563eb' },
  navTexto: { color: '#fff', fontWeight: 'bold', fontSize: 11 },

  bannerNotif: { backgroundColor: '#22c55e', padding: 8, borderRadius: 8, marginBottom: 10 },

  conversorCaja: { backgroundColor: '#1e293b', padding: 12, borderRadius: 12, marginBottom: 15 },
  conversorTitulo: { color: '#f8fafc', fontWeight: 'bold', marginBottom: 8 },
  conversorInputs: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputConv: { flex: 1, backgroundColor: '#0f172a', color: '#fff', padding: 8, borderRadius: 8, textAlign: 'center' },

  seccionTitulo: { color: '#f8fafc', fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  btnNuevoProd: { backgroundColor: '#2563eb', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  
  tarjetaProducto: { backgroundColor: '#1e293b', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  tarjetaInventario: { backgroundColor: '#1e293b', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  prodNombre: { color: '#f8fafc', fontSize: 15, fontWeight: 'bold' },
  prodMargen: { color: '#64748b', fontSize: 11 },
  prodPrecioUSD: { color: '#22c55e', fontSize: 15, fontWeight: 'bold' },
  prodPrecioBS: { color: '#94a3b8', fontSize: 12 },
  btnEliminar: { backgroundColor: '#ef4444', padding: 8, borderRadius: 8, marginLeft: 10 },

  tarjetaDeudor: { backgroundColor: '#1e293b', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  btnCobrarWhatsApp: { backgroundColor: '#22c55e', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },

  cajaCierre: { backgroundColor: '#1e293b', padding: 15, borderRadius: 12, alignItems: 'center' },
  cierreMontoUSD: { color: '#22c55e', fontSize: 28, fontWeight: 'bold' },
  cierreMontoBS: { color: '#94a3b8', fontSize: 16 },
  tarjetaVenta: { backgroundColor: '#1e293b', padding: 10, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },

  barraCarrito: { backgroundColor: '#1e293b', padding: 12, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', bottom: 15, left: 12, right: 12, elevation: 10 },
  cartTotalUSD: { color: '#22c55e', fontSize: 16, fontWeight: 'bold' },
  cartTotalBS: { color: '#38bdf8', fontSize: 12 },
  btnCobrar: { backgroundColor: '#22c55e', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  btnTexto: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContenido: { backgroundColor: '#1e293b', padding: 20, borderRadius: 15 },
  modalTitulo: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  btnOpcion: { flex: 1, backgroundColor: '#334155', padding: 8, borderRadius: 8, alignItems: 'center' },
  btnOpcionActiva: { backgroundColor: '#2563eb' },
  btnMetodo: { backgroundColor: '#334155', padding: 10, borderRadius: 8, marginRight: 8 },
  btnMetodoActivo: { backgroundColor: '#22c55e' },
  inputModal: { backgroundColor: '#0f172a', color: '#fff', padding: 10, borderRadius: 8, marginBottom: 10 },
  btnAccion: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' }
});
