import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EstadoCliente } from './estado-cliente';

describe('EstadoCliente', () => {
  let component: EstadoCliente;
  let fixture: ComponentFixture<EstadoCliente>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstadoCliente],
    }).compileComponents();

    fixture = TestBed.createComponent(EstadoCliente);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
