import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CombosService } from '../../services/combos.service';
import { ProductosService } from '../../services/productos.service';

export interface OpcionProductoCombo {
  nombre: string;
  categoria: string;
  stock: number;
}

@Component({
  selector: 'app-crear-combo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './crear-combo.html',
  styleUrls: ['./crear-combo.css'],
})
export class CrearComboComponent implements OnInit {
  private fb = inject(FormBuilder);
  private combosService = inject(CombosService);
  private productosService = inject(ProductosService);
  private router = inject(Router);

  comboForm!: FormGroup;

  submitted = signal<boolean>(false);
  subiendoImagen = signal<boolean>(false);
  selectedFile = signal<File | null>(null);

  productosDisponiblesUnicos = signal<OpcionProductoCombo[]>([]);
  categorias = signal<string[]>(['comida', 'bebida', 'juguete', 'ropa']);

  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  ngOnInit(): void {
    this.inicializarFormulario();
    this.cargarProductosUnicos();
    this.agregarItem();
  }

  private inicializarFormulario(): void {
    this.comboForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      descripcion: [''],
      precio_dinero: [0, [Validators.required, Validators.min(0)]],
      precio_puntos: [0, [Validators.required, Validators.min(0)]],
      incluye_entrada: [false],
      cantidad_entradas: [1, [Validators.min(1)]],
      activo: [true],
      items: this.fb.array([]),
    });

    this.comboForm.get('incluye_entrada')?.valueChanges.subscribe((incluye: boolean) => {
      const ctrl = this.comboForm.get('cantidad_entradas');
      if (incluye) {
        ctrl?.setValidators([Validators.required, Validators.min(1)]);
        if (!ctrl?.value || ctrl.value < 1) {
          ctrl?.setValue(1);
        }
      } else {
        ctrl?.clearValidators();
        ctrl?.setValue(0);
      }
      ctrl?.updateValueAndValidity();
    });
  }

  get itemsArray(): FormArray {
    return this.comboForm.get('items') as FormArray;
  }

  agregarItem(): void {
    const fila = this.fb.group({
      producto_nombre: ['', [Validators.required]],
      categoria: ['comida', [Validators.required]],
      cantidad: [1, [Validators.required, Validators.min(1)]],
    });
    this.itemsArray.push(fila);
  }

  quitarItem(index: number): void {
    if (this.itemsArray.length > 1) {
      this.itemsArray.removeAt(index);
    }
  }

  async cargarProductosUnicos(): Promise<void> {
    try {
      const agrupados = await this.productosService.getProductosAgrupados();
      const mapaUnicos = new Map<string, OpcionProductoCombo>();

      for (const p of agrupados || []) {
        const nombreLimpio = (p.nombre || '').trim();
        const categoriaLimpia = (p.categoria || 'comida').trim().toLowerCase();
        if (!nombreLimpio) continue;

        const clave = `${nombreLimpio.toLowerCase()}|${categoriaLimpia}`;
        const stockActual = Number(p.stock) || 0;

        if (mapaUnicos.has(clave)) {
          const existente = mapaUnicos.get(clave)!;
          existente.stock += stockActual;
        } else {
          mapaUnicos.set(clave, {
            nombre: nombreLimpio,
            categoria: categoriaLimpia,
            stock: stockActual,
          });
        }
      }

      this.productosDisponiblesUnicos.set(Array.from(mapaUnicos.values()));
    } catch (error) {
      console.error('Error al cargar productos agrupados para el combo:', error);
    }
  }

  onSeleccionarProductoEnFila(index: number, event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const nombreElegido = (selectElement?.value || '').trim();

    const encontrado = this.productosDisponiblesUnicos().find(
      (p) => p.nombre.toLowerCase() === nombreElegido.toLowerCase()
    );

    if (encontrado) {
      this.itemsArray.at(index).patchValue({
        producto_nombre: encontrado.nombre,
        categoria: encontrado.categoria,
      });
    }
  }

  obtenerStockDeProducto(nombre: string | null | undefined): number {
    if (!nombre) return 0;
    const prod = this.productosDisponiblesUnicos().find(
      (p) => p.nombre.toLowerCase() === nombre.trim().toLowerCase()
    );
    return prod ? prod.stock : 0;
  }

  onFileSelected(event: any): void {
    const file: File = event.target?.files?.[0];
    if (file) {
      this.selectedFile.set(file);
    }
  }

  async onSubmit(): Promise<void> {
    this.submitted.set(true);

    if (this.comboForm.invalid) {
      this.comboForm.markAllAsTouched();
      this.mensajeError.set('Completá todos los campos obligatorios del combo.');
      return;
    }

    this.subiendoImagen.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);

    try {
      let urlImagen = '';
      const file = this.selectedFile();
      if (file) {
        urlImagen = await this.productosService.subirImagenProducto(file);
      }

      const val = this.comboForm.value;
      await this.combosService.crearCombo({
        nombre: val.nombre.trim(),
        descripcion: val.descripcion?.trim() || null,
        imagen: urlImagen || null,
        precio_dinero: Number(val.precio_dinero) || 0,
        precio_puntos: Math.max(0, Math.floor(Number(val.precio_puntos) || 0)),
        incluye_entrada: Boolean(val.incluye_entrada),
        cantidad_entradas: val.incluye_entrada ? Number(val.cantidad_entradas) || 1 : 0,
        activo: Boolean(val.activo),
        items: (val.items || []).map((it: any) => ({
          producto_nombre: it.producto_nombre?.trim() || null,
          categoria: it.categoria,
          cantidad: Number(it.cantidad) || 1,
        })),
      });

      this.mensajeExito.set('¡Combo creado correctamente!');
      setTimeout(() => {
        this.router.navigate(['/candybar']);
      }, 700);
    } catch (err: any) {
      this.mensajeError.set(err.message || 'No se pudo crear el combo.');
    } finally {
      this.subiendoImagen.set(false);
    }
  }

  cancelar(): void {
    this.submitted.set(false);
    this.selectedFile.set(null);
    this.comboForm.reset({
      nombre: '',
      descripcion: '',
      precio_dinero: 0,
      precio_puntos: 0,
      incluye_entrada: false,
      cantidad_entradas: 1,
      activo: true,
    });
    this.router.navigate(['/candybar']);
  }
}