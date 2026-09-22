import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistrarEmpleadoComponent } from './registrar-empleado.componet';

describe('RegistrarEmpleado', () => {
  let component: RegistrarEmpleadoComponent;
  let fixture: ComponentFixture<RegistrarEmpleadoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrarEmpleadoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrarEmpleadoComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
