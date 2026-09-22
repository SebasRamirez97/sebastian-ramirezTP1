import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerificarEntradaComponent } from './verificar-entrada.component';

describe('VerificarEntrada', () => {
  let component: VerificarEntradaComponent;
  let fixture: ComponentFixture<VerificarEntradaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerificarEntradaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VerificarEntradaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
