import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient';

@Injectable({
  providedIn: 'root'
})
export class AdminCuponesService {

  // 🇦🇷 Obtener la fecha actual exacta en Argentina (Formato YYYY-MM-DD y componentes)
  private obtenerFechaArgentina() {
    const formatter = new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const anio = parseInt(parts.find(p => p.type === 'year')?.value || '2026', 10);
    const mes = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10);
    const dia = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);

    const fechaStr = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    return { fechaStr, anio, mes, dia };
  }

  // Obtener todos los cupones (Admin)
  async obtenerCupones() {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  }

  // Crear un cupón nuevo
  async crearCupon(coupon: { 
    code: string; 
    discount_percentage: number; 
    tipo: string;
    is_welcome?: boolean; 
    min_age?: number | null;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    fecha_especifica?: string | null;
  }) {
    const { data, error } = await supabase
      .from('coupons')
      .insert([coupon]);
    return { data, error };
  }

  // Actualizar cupón
  async actualizarCupon(id: string, updates: { 
    discount_percentage?: number; 
    active?: boolean; 
    tipo?: string; 
    min_age?: number | null;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    fecha_especifica?: string | null;
  }) {
    const { data, error } = await supabase
      .from('coupons')
      .update(updates)
      .eq('id', id);
    return { data, error };
  }

  // Eliminar un cupón
  async eliminarCupon(id: string) {
    const { data, error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);
    return { data, error };
  }

  // 🌟 Evaluar y auto-asignar el cupón de cumpleaños usando la fecha de Argentina
  async verificarYAsignarCuponCumpleanos(userId: string): Promise<void> {
    try {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('fecha_nacimiento')
        .eq('id', userId)
        .single();

      if (!cliente || !cliente.fecha_nacimiento) return;

      const { mes: mesArg, dia: diaArg } = this.obtenerFechaArgentina();
      
      const partesNac = cliente.fecha_nacimiento.toString().split('T')[0].split('-');
      if (partesNac.length !== 3) return;
      const mesNac = parseInt(partesNac[1], 10);
      const diaNac = parseInt(partesNac[2], 10);

      const esCumple = diaArg === diaNac && mesArg === mesNac;
      if (!esCumple) return;

      // Buscar cupón de tipo cumpleaños activo (Soporta 'cumpleanos' y 'cumpleaños')
      const { data: cuponCumple } = await supabase
        .from('coupons')
        .select('id, min_age')
        .in('tipo', ['cumpleanos', 'cumpleaños'])
        .eq('active', true)
        .single();

      if (!cuponCumple) return;

      // Validar si el cliente cumple con la edad mínima del cupón antes de asignarlo
      if (cuponCumple.min_age && cuponCumple.min_age > 0) {
        const cumpleEdad = await this.verificarEdadCliente(userId, cuponCumple.min_age);
        if (!cumpleEdad) return;
      }

      // Verificar si ya lo tiene asignado
      const { data: yaAsignado } = await supabase
        .from('user_coupons')
        .select('id')
        .eq('user_id', userId)
        .eq('coupon_id', cuponCumple.id)
        .single();

      if (!yaAsignado) {
        await supabase.from('user_coupons').insert({
          user_id: userId,
          coupon_id: cuponCumple.id,
          is_used: false
        });
      }
    } catch (err) {
      console.error('Error al verificar cumpleaños:', err);
    }
  }

  // Obtener los cupones disponibles y no usados del cliente (filtrando bienvenida y edad mínima)
  async obtenerCuponesDelCliente(userId: string) {
    await this.verificarYAsignarCuponCumpleanos(userId);

    const { fechaStr: hoyArg } = this.obtenerFechaArgentina();

    // 1. Verificar si el cliente ya hizo su primera compra (tiene órdenes)
    const { count: totalOrdenes } = await supabase
      .from('ordenes')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', userId);

    const yaCompro = (totalOrdenes || 0) > 0;

    // 2. Traer los cupones asignados y no usados del usuario
    const { data: userCouponsData, error } = await supabase
      .from('user_coupons')
      .select(`
        id,
        is_used,
        assigned_at,
        coupons (
          id,
          code,
          discount_percentage,
          tipo,
          is_welcome,
          min_age,
          fecha_inicio,
          fecha_fin,
          fecha_especifica,
          active
        )
      `)
      .eq('user_id', userId)
      .eq('is_used', false);

    if (error) {
      console.error('Error al obtener cupones del cliente:', error);
      return { data: [], error };
    }

    // 3. Filtrar cupones asignados (bienvenida si ya compró, y validación estricta de edad mínima)
    // 3. Filtrar cupones asignados (bienvenida si ya compró, y validación estricta de edad mínima)
    const cuponesAsignados: any[] = [];
    for (const item of userCouponsData) {
      // 🌟 Hacemos un casting explícito a any para evitar que TypeScript reclame por las propiedades
      const cupon = item.coupons as any;

      if (!cupon || cupon.active === false) continue;

      const esBienvenida = cupon.is_welcome || cupon.tipo === 'bienvenida';
      if (yaCompro && esBienvenida) continue; // Ocultar bienvenida si ya compró

      // 🌟 Validar edad mínima si el cupón la requiere
      if (cupon.min_age && cupon.min_age > 0) {
        const cumpleEdad = await this.verificarEdadCliente(userId, cupon.min_age);
        if (!cumpleEdad) continue; // Ocultar si el cliente es menor a la edad mínima
      }

      cuponesAsignados.push({
        userCouponId: item.id,
        ...cupon
      });
    }
    // 4. Traer cupones generales vigentes (rango de fechas o fecha específica)
    const { data: cuponesGenerales } = await supabase
      .from('coupons')
      .select('*')
      .eq('active', true);

    const cuponesGeneralesVigentes: any[] = [];
    for (const c of (cuponesGenerales || [])) {
      const esBienvenida = c.is_welcome || c.tipo === 'bienvenida';
      if (yaCompro && esBienvenida) continue;

      // 🌟 Validar edad mínima para cupones generales
      if (c.min_age && c.min_age > 0) {
        const cumpleEdad = await this.verificarEdadCliente(userId, c.min_age);
        if (!cumpleEdad) continue;
      }

      let esVigente = false;
      if (c.fecha_inicio && c.fecha_fin) {
        const inicio = c.fecha_inicio.toString().split('T')[0];
        const fin = c.fecha_fin.toString().split('T')[0];
        if (inicio <= hoyArg && fin >= hoyArg) esVigente = true;
      }
      if (c.fecha_especifica) {
        const esp = c.fecha_especifica.toString().split('T')[0];
        if (esp === hoyArg) esVigente = true;
      }

      if (esVigente) {
        cuponesGeneralesVigentes.push({
          userCouponId: null,
          ...c
        });
      }
    }

    // 5. Unir ambos sin duplicar
    const todosDisponibles = [...cuponesAsignados];
    for (const gen of cuponesGeneralesVigentes) {
      if (!todosDisponibles.some(existing => existing.id === gen.id)) {
        todosDisponibles.push(gen);
      }
    }

    return { data: todosDisponibles, error: null };
  }

  // Marcar un cupón como usado tras una compra exitosa
  async marcarCuponComoUsado(userCouponId: string) {
    const { data, error } = await supabase
      .from('user_coupons')
      .update({ is_used: true })
      .eq('id', userCouponId);
      
    return { data, error };
  }

  // 🌟 Validación centralizada de cupones utilizando fecha exacta de Argentina
  async validarCuponParaUsuario(codigo: string, userId: string | null, cuponesActuales: any[]): Promise<{ valido: boolean; mensaje: string; cupon?: any }> {
    const codigoLimpio = codigo.trim().toUpperCase();

    if (!codigoLimpio) {
      return { valido: false, mensaje: 'Por favor, ingresa un código de cupón.' };
    }

    if (cuponesActuales.some(c => c.code === codigoLimpio)) {
      return { valido: false, mensaje: 'Este cupón ya ha sido aplicado.' };
    }

    if (cuponesActuales.length >= 2) {
      return { valido: false, mensaje: 'Solo puedes aplicar un máximo de dos cupones.' };
    }

    const { data: cuponData, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', codigoLimpio)
      .single();

    if (error || !cuponData) {
      return { valido: false, mensaje: 'El cupón ingresado no existe.' };
    }

    if (cuponesActuales.length === 1) {
      const yaTieneBienvenida = cuponesActuales.some((c) => c.is_welcome || c.tipo === 'bienvenida');
      const nuevoEsBienvenida = cuponData.is_welcome || cuponData.tipo === 'bienvenida';

      if (!yaTieneBienvenida && !nuevoEsBienvenida) {
        return { valido: false, mensaje: 'Los cupones promocionales no son acumulables entre sí.' };
      }
      if (yaTieneBienvenida && nuevoEsBienvenida) {
        return { valido: false, mensaje: 'Ya has aplicado el cupón de bienvenida.' };
      }
    }

    // Validación 1: Edad Mínima
    if (cuponData.min_age && cuponData.min_age > 0) {
      if (!userId) {
        return { valido: false, mensaje: 'Debes iniciar sesión para usar este cupón exclusivo por edad.' };
      }
      const cumpleEdad = await this.verificarEdadCliente(userId, cuponData.min_age);
      if (!cumpleEdad) {
        return { valido: false, mensaje: `Este cupón es exclusivo para usuarios mayores de ${cuponData.min_age} años.` };
      }
    }

    // Obtenemos la fecha actual de Argentina en string "YYYY-MM-DD"
    const { fechaStr: hoyArg } = this.obtenerFechaArgentina();

    // Validación 2: Rango de Fechas (inicio / fin) comparando strings directamente
    if (cuponData.fecha_inicio && cuponData.fecha_fin) {
      const inicioStr = cuponData.fecha_inicio.toString().split('T')[0];
      const finStr = cuponData.fecha_fin.toString().split('T')[0];

      if (inicioStr > hoyArg || finStr < hoyArg) {
        return { valido: false, mensaje: 'Este cupón se encuentra fuera de su rango de fechas válido.' };
      }
    }

    // Validación 3: Fecha Específica comparando strings directamente
    if (cuponData.fecha_especifica) {
      const espStr = cuponData.fecha_especifica.toString().split('T')[0];
      if (espStr !== hoyArg) {
        return { valido: false, mensaje: 'Este cupón solo es válido para el día de hoy.' };
      }
    }

    // Validación 4: Bienvenida (Primera Compra)
    if (cuponData.is_welcome || cuponData.tipo === 'bienvenida') {
      if (!userId) {
        return { valido: false, mensaje: 'Debes iniciar sesión para utilizar el cupón de bienvenida.' };
      }
      const { count } = await supabase
        .from('ordenes')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', userId);

      if (count && count > 0) {
        return { valido: false, mensaje: 'El cupón de bienvenida solo es válido para la primera compra.' };
      }
    }

    // Validación 5: Cumpleaños
    if (cuponData.tipo === 'cumpleanos' || cuponData.tipo === 'cumpleaños') {
      if (!userId) {
        return { valido: false, mensaje: 'Debes iniciar sesión para utilizar tu cupón de cumpleaños.' };
      }
      const esSuCumple = await this.verificarEsCumpleanos(userId);
      if (!esSuCumple) {
        return { valido: false, mensaje: 'Este cupón solo puede ser utilizado el día de tu cumpleaños.' };
      }
    }

    return { 
      valido: true, 
      mensaje: `¡Cupón "${cuponData.code}" aplicado con éxito! (${cuponData.discount_percentage}% desc)`, 
      cupon: cuponData 
    };
  }

  private async verificarEdadCliente(usuarioId: string, edadMinima: number): Promise<boolean> {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('fecha_nacimiento')
      .eq('id', usuarioId)
      .single();

    if (!cliente || !cliente.fecha_nacimiento) return false;

    const partesNac = cliente.fecha_nacimiento.toString().split('T')[0].split('-');
    const anioNac = parseInt(partesNac[0], 10);
    const mesNac = parseInt(partesNac[1], 10);
    const diaNac = parseInt(partesNac[2], 10);

    const { anio: anioArg, mes: mesArg, dia: diaArg } = this.obtenerFechaArgentina();

    let edad = anioArg - anioNac;
    if (mesArg < mesNac || (mesArg === mesNac && diaArg < diaNac)) {
      edad--;
    }

    return edad >= edadMinima;
  }

  private async verificarEsCumpleanos(usuarioId: string): Promise<boolean> {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('fecha_nacimiento')
      .eq('id', usuarioId)
      .single();

    if (!cliente || !cliente.fecha_nacimiento) return false;

    const { mes: mesArg, dia: diaArg } = this.obtenerFechaArgentina();
    const partesNac = cliente.fecha_nacimiento.toString().split('T')[0].split('-');
    if (partesNac.length !== 3) return false;

    const mesNac = parseInt(partesNac[1], 10);
    const diaNac = parseInt(partesNac[2], 10);

    return diaArg === diaNac && mesArg === mesNac;
  }
}