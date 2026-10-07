import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient';

export interface Producto {
  id?: string;
  nombre: string;
  categoria: string;
  precio_dinero: number;
  precio_puntos: number;
  imagen?: string;
  estado?: 'disponible' | 'reservado' | 'vendido'; // 👈 Nuevo campo de la BD
  orden_id?: string | null;                       // 👈 Nuevo campo para la vinculación
  stock?: number;                                 // 👈 Calculado dinámicamente al agrupar
  cantidadDeseada?: number;                       // 👈 Para el carrito local del usuario
}

@Injectable({
  providedIn: 'root',
})
export class ProductosService {
  // Guardamos una referencia interna de los productos crudos (individuales) de la BD
  private productosCrudos: Producto[] = [];
  private itemsCarritoTemporal: any[] = [];

  constructor() {}

  async getProductos(): Promise<Producto[]> {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error al consultar productos:', error.message);
      throw error;
    }
    return (data as Producto[]) || [];
  }

  /**
   * 🍬 Trae los productos de la BD FILTRANDO solo los que están 'disponible',
   * y los agrupa por nombre para calcular el stock real en la vista del Candy Bar.
   */
  async getProductosAgrupados(): Promise<Producto[]> {
    // 🔹 IMPORTANTE: Solo traemos los que estén disponibles para evitar mostrar stock reservado/vendido
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('estado', 'disponible')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error al consultar productos disponibles:', error.message);
      throw error;
    }

    this.productosCrudos = (data as Producto[]) || [];
    const mapa = new Map<string, Producto>();

    for (const prod of this.productosCrudos) {
      if (mapa.has(prod.nombre)) {
        const existente = mapa.get(prod.nombre)!;
        existente.stock = (existente.stock || 1) + 1;
      } else {
        mapa.set(prod.nombre, {
          ...prod,
          stock: 1,
          cantidadDeseada: 0,
        });
      }
    }

    return Array.from(mapa.values());
  }

  /**
   * ➕ Permite al administrador sumar stock rápidamente clonando registros
   * con la misma información, la misma imagen y estado 'disponible' por defecto.
   */
  async agregarStockMasivo(productoBase: Producto, cantidad: number): Promise<void> {
    for (let i = 0; i < cantidad; i++) {
      const { error } = await supabase.from('productos').insert([
        {
          nombre: productoBase.nombre,
          categoria: productoBase.categoria,
          precio_dinero: productoBase.precio_dinero,
          precio_puntos: productoBase.precio_puntos,
          imagen: productoBase.imagen || '',
          estado: 'disponible', // 👈 Aseguramos que nazca disponible
        },
      ]);

      if (error) {
        console.error('Error al agregar stock masivo:', error);
        throw error;
      }
    }
  }

  /**
   * 🛒 Extrae los IDs físicos exactos de los productos seleccionados por el cliente
   * para empaquetarlos en la orden unificada de la compra.
   */
  obtenerItemsSeleccionadosParaCheckout(productosAgrupados: Producto[]) {
    return productosAgrupados
      .filter((p) => (p.cantidadDeseada || 0) > 0)
      .map((p) => {
        // Buscamos los IDs individuales exactos en los datos crudos disponibles según la cantidad elegida
        const idsFisicos = this.productosCrudos
          .filter((raw) => raw.nombre === p.nombre && raw.estado === 'disponible')
          .slice(0, p.cantidadDeseada)
          .map((raw) => raw.id!);

        return {
          nombre: p.nombre,
          precio: p.precio_dinero,
          cantidad: p.cantidadDeseada,
          idsFisicos: idsFisicos, // Vital para reservarlos al confirmar la compra
        };
      });
  }

  async agregarProducto(producto: Omit<Producto, 'id'>): Promise<Producto> {
    // Al crear un producto individual nuevo, aseguramos que nazca con estado 'disponible'
    const productoConEstado = {
      ...producto,
      estado: 'disponible'
    };

    const { data, error } = await supabase.from('productos').insert([productoConEstado]).select().single();

    if (error) {
      console.error('Error al insertar producto:', error);
      throw error;
    }
    return data;
  }

  async subirImagenProducto(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `candy_${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage.from('posters').upload(filePath, file);

    if (uploadError) {
      console.error('Error al subir imagen de producto:', uploadError.message);
      throw uploadError;
    }

    const { data } = supabase.storage.from('posters').getPublicUrl(filePath);
    return data.publicUrl;
  }

  guardarCarritoTemp(items: any[]) {
  this.itemsCarritoTemporal = items;
}

obtenerCarritoTemp(): any[] {
  return this.itemsCarritoTemporal;
}
}