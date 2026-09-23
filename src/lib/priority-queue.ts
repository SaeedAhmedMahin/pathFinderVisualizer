interface QueueNode<T> {
  item: T;
  priority: number;
}

export class MinPriorityQueue<T> {
  private heap: QueueNode<T>[] = [];
  private indices: Map<T, number> = new Map();

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  has(item: T): boolean {
    return this.indices.has(item);
  }

  peek(): QueueNode<T> | null {
    return this.heap[0] ?? null;
  }

  push(item: T, priority: number): void {
    if (this.indices.has(item)) {
      this.decreaseKey(item, priority);
      return;
    }
    const node: QueueNode<T> = { item, priority };
    this.heap.push(node);
    const index = this.heap.length - 1;
    this.indices.set(item, index);
    this.bubbleUp(index);
  }

  pop(): QueueNode<T> | null {
    if (this.heap.length === 0) return null;
    const min = this.heap[0];
    this.indices.delete(min.item);

    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.indices.set(last.item, 0);
      this.bubbleDown(0);
    }
    return min;
  }

  decreaseKey(item: T, newPriority: number): void {
    const index = this.indices.get(item);
    if (index === undefined) {
      this.push(item, newPriority);
      return;
    }
    if (newPriority < this.heap[index].priority) {
      this.heap[index].priority = newPriority;
      this.bubbleUp(index);
    }
  }

  toArray(): T[] {
    return this.heap.map((n) => n.item);
  }

  private bubbleUp(index: number): void {
    let curr = index;
    while (curr > 0) {
      const parent = (curr - 1) >> 1;
      if (this.heap[curr].priority < this.heap[parent].priority) {
        this.swap(curr, parent);
        curr = parent;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number): void {
    let curr = index;
    const length = this.heap.length;

    while (true) {
      const left = (curr << 1) + 1;
      const right = left + 1;
      let smallest = curr;

      if (
        left < length &&
        this.heap[left].priority < this.heap[smallest].priority
      ) {
        smallest = left;
      }
      if (
        right < length &&
        this.heap[right].priority < this.heap[smallest].priority
      ) {
        smallest = right;
      }

      if (smallest !== curr) {
        this.swap(curr, smallest);
        curr = smallest;
      } else {
        break;
      }
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
    this.indices.set(this.heap[i].item, i);
    this.indices.set(this.heap[j].item, j);
  }
}
