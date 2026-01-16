export function Store() {
  window.Alpine.data("counter", () => ({
    count: 0,
    get text() {
      return `TIMES CLICKED: ${this.count}`;
    },
    increment() {
      this.count++;
    },
    decrement() {
      this.count--;
    },
  }));

  window.Alpine.data("carwashNav", () => ({
    openModal(type: string) {
      console.log(`Opening ${type} modal`);
    },
  }));

  window.Alpine.data("pricingPlans", () => ({
    selectedPlan: null as string | null,
    selectPlan(plan: string) {
      this.selectedPlan = plan;
      console.log(`Selected plan: ${plan}`);
    },
  }));
}
