export interface ClienteMetadata {
  rol: 'cliente';
  // 👇 atributos de negocio
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  tipoSangre: string;
  colorOjos: string;
  vacaciones: number;
}

export interface EmpleadoMetadata {
  rol: 'empleado';
  // 👇 atributos de negocio
  nombre: string;
  apellido: string;
  estado?: string; // opcional, porque puede ser 'activo' por defecto
}

export interface AdminMetadata {
  rol: 'admin';
  // 👇 atributos de negocio
  nombre: string;
  apellido: string;
  // a futuro podés agregar permisos, área, etc.
}

export interface AnonimoMetadata {
  rol: 'anonimo';
  nombre?: string;
}