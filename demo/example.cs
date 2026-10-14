namespace MyApp;

class Vehicle {
  public string brand = "Ford";
  public void honk() {
    Console.WriteLine("Honk!");
  }
}

class Car : Vehicle {
  public string modelName = "Mustang";
}

class Program {
  static void Main(string[] args) {
    Car myCar = new Car();

    myCar.honk();

    Console.WriteLine(myCar.brand + " " + myCar.modelName);

    Array.Sort<int>(myNumbers);

    Console.WriteLine($"Doing {noun}...");

    string json = $$"""
      {
        "name": {{name.toUpperCase("foo")}}
      }
    """;

  }
}

static readonly string[] signinMethods = {
  "Credentials",
  "QR Code"
};
