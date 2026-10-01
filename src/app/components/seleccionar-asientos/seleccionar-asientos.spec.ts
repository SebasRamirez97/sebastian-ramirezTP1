import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeleccionarAsientosComponent } from './seleccionar-asientos';

describe('SeleccionarAsientos', () => {
  let component: SeleccionarAsientosComponent;
  let fixture: ComponentFixture<SeleccionarAsientosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeleccionarAsientosComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SeleccionarAsientosComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
